import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Magic bytes for file type validation
const MAGIC_BYTES = {
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  gif: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF header, followed by WEBP at bytes 8-11
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4B, 0x03, 0x04]], // PK.. (ZIP archive)
};

// Validate file magic bytes match claimed type
function validateMagicBytes(base64Content: string, expectedType: 'image' | 'pdf' | 'docx'): { valid: boolean; detectedType: string | null } {
  try {
    // Remove data URL prefix and get raw base64
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Decode first 16 bytes for checking
    const binaryString = atob(base64Data.substring(0, 24)); // 24 base64 chars = 18 bytes
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check for each known type
    const matchesMagic = (patterns: number[][]) => {
      return patterns.some(pattern => 
        pattern.every((byte, idx) => bytes[idx] === byte)
      );
    };

    // Detect actual file type
    if (matchesMagic(MAGIC_BYTES.jpeg)) return { valid: expectedType === 'image', detectedType: 'jpeg' };
    if (matchesMagic(MAGIC_BYTES.png)) return { valid: expectedType === 'image', detectedType: 'png' };
    if (matchesMagic(MAGIC_BYTES.gif)) return { valid: expectedType === 'image', detectedType: 'gif' };
    if (matchesMagic(MAGIC_BYTES.webp)) return { valid: expectedType === 'image', detectedType: 'webp' };
    if (matchesMagic(MAGIC_BYTES.pdf)) return { valid: expectedType === 'pdf', detectedType: 'pdf' };
    if (matchesMagic(MAGIC_BYTES.docx)) return { valid: expectedType === 'docx', detectedType: 'docx' };

    return { valid: false, detectedType: null };
  } catch (err) {
    console.error('Magic byte validation error:', err);
    return { valid: false, detectedType: null };
  }
}

// Extract text content from DOCX file (which is a ZIP containing XML)
async function extractTextFromDocx(base64Content: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load as ZIP
    const zip = await JSZip.loadAsync(bytes);
    
    // Get the main document content
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('No document.xml found in DOCX');
    }
    
    // Extract text from XML - simple regex-based extraction
    // Remove XML tags and extract text content
    let text = documentXml
      // Extract text from <w:t> tags (Word text elements)
      .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
      // Handle paragraph breaks
      .replace(/<\/w:p>/g, '\n')
      // Remove remaining XML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Clean up whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    console.log(`Extracted ${text.length} characters from DOCX`);
    return text;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX file');
  }
}

// Background image generation - runs after response is sent
async function generateRecipeImagesInBackground(
  recipeIds: { id: string; title: string; description: string | null }[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Generate images in parallel (max 3 at a time to avoid rate limits)
  const batchSize = 3;
  for (let i = 0; i < recipeIds.length; i += batchSize) {
    const batch = recipeIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (recipe) => {
      try {
        console.log(`Generating image for recipe: ${recipe.title}`);
        
        // Image prompt following strict guidelines:
        // - Show final plated dish only
        // - Match ingredients, portions, and cooking method
        // - No extra garnish, props, or text
        // - Realistic, home-cooked appearance
        const imagePrompt = `Professional food photography of a home-cooked ${recipe.title}. ${recipe.description || ''}
Final plated dish only. Realistic home-cooked appearance. Match the actual ingredients and portions from the recipe.
No text, no extra garnish or props not in the recipe. Natural lighting, overhead or 45-degree angle, clean simple background, appetizing presentation.
16:9 aspect ratio, high-quality food photography style.`;

        const imageResponse = await fetch(LOVABLE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: imagePrompt }],
            modalities: ['image', 'text']
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImageUrl) {
            await supabase.from('recipes').update({
              image_url: generatedImageUrl
            }).eq('id', recipe.id);
            console.log(`Image saved for: ${recipe.title}`);
          }
        }
      } catch (err) {
        console.error(`Failed to generate image for ${recipe.title}:`, err);
      }
    }));
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Check if this is a service-role request for seeding global recipes
    const isServiceRole = token === supabaseServiceKey;
    
    let userId: string | null = null;
    
    if (isServiceRole) {
      // Service role access - for seeding global recipes
      console.log('Service role access: seeding global recipes');
    } else {
      // Regular user authentication
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Use getUser() to validate the token and get user info
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Authentication failed:', userError?.message || 'No user found');
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = userData.user.id;
      console.log(`Authenticated user: ${userId}`);
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { uploadId, content, sourceUrl, fileType, isImage, title, filters, seedGlobal } = await req.json();

    // ========== SEED GLOBAL MODE VALIDATION ==========
    // If seedGlobal is true, service-role is required and uploadId is optional
    if (seedGlobal && !isServiceRole) {
      console.error('Seed global mode requires service-role authentication');
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: seedGlobal requires service-role access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== INPUT VALIDATION ==========
    
    // 1. Validate uploadId format (UUID) - skip if seedGlobal mode
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!seedGlobal && (!uploadId || typeof uploadId !== 'string' || !uuidRegex.test(uploadId))) {
      console.error('Invalid upload ID format:', uploadId);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid upload ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate content size (max 10MB for base64 content)
    const MAX_CONTENT_SIZE = 10_000_000; // 10MB
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_SIZE) {
      console.error('Content too large:', content.length);
      return new Response(
        JSON.stringify({ success: false, error: 'Content exceeds maximum size of 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate image format if isImage flag is set (MIME type + magic bytes)
    if (isImage && content) {
      const validImagePattern = /^data:image\/(jpeg|jpg|png|gif|webp|heic);base64,/i;
      if (typeof content !== 'string' || !validImagePattern.test(content)) {
        console.error('Invalid image format');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid image format. Supported: JPEG, PNG, GIF, WebP' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate magic bytes match claimed MIME type (excluding HEIC which has complex structure)
      const mimeMatch = content.match(/^data:image\/(jpeg|jpg|png|gif|webp)/i);
      if (mimeMatch) {
        const magicResult = validateMagicBytes(content, 'image');
        if (!magicResult.valid) {
          console.error(`Magic byte mismatch: claimed ${mimeMatch[1]}, detected ${magicResult.detectedType || 'unknown'}`);
          return new Response(
            JSON.stringify({ success: false, error: 'File content does not match declared image type' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 4. Validate sourceUrl format if provided
    if (sourceUrl && typeof sourceUrl === 'string') {
      try {
        const url = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        console.error('Invalid source URL:', sourceUrl);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid source URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if content is a base64-encoded document (PDF, DOCX) and validate magic bytes
    const isDocx = content && typeof content === 'string' && 
      (content.startsWith('data:application/vnd.openxmlformats') ||
       content.startsWith('data:application/msword') ||
       (content.startsWith('data:application/octet-stream') && content.includes('docx')));
    
    const isPdf = content && typeof content === 'string' && 
      content.startsWith('data:application/pdf');

    const isBase64Document = isDocx || isPdf;

    // Validate document magic bytes
    if (isPdf && content) {
      const magicResult = validateMagicBytes(content, 'pdf');
      if (!magicResult.valid) {
        console.error(`PDF magic byte mismatch: detected ${magicResult.detectedType || 'unknown'}`);
        return new Response(
          JSON.stringify({ success: false, error: 'File content does not match PDF format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isDocx && content) {
      const magicResult = validateMagicBytes(content, 'docx');
      if (!magicResult.valid) {
        console.error(`DOCX magic byte mismatch: detected ${magicResult.detectedType || 'unknown'}`);
        return new Response(
          JSON.stringify({ success: false, error: 'File content does not match DOCX format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For documents, we'll send the base64 directly to AI for processing
    // For text, validate size
    if (!isImage && !isBase64Document && content && typeof content === 'string') {
      const MAX_TEXT_SIZE = 100_000; // 100KB
      if (content.length > MAX_TEXT_SIZE) {
        console.error('Text content too large:', content.length);
        return new Response(
          JSON.stringify({ success: false, error: 'Text content exceeds maximum size of 100KB' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Processing ${seedGlobal ? 'seed global' : 'upload ' + uploadId}, isImage: ${isImage}, isDocx: ${isDocx}, isPdf: ${isPdf}`);

    // Update status to parsing (skip if seedGlobal mode)
    if (!seedGlobal && uploadId) {
      await supabase.from('uploads').update({ status: 'parsing' }).eq('id', uploadId);
    }

    // Build the prompt based on content type
    const systemPrompt = `You are an AI expert in nutrition science, metabolic health, professional cooking, recipe engineering, macro calculation, and meal scaling.
Your job is to extract and generate complete, accurate recipes from any provided content.

CORE PRINCIPLES:
- Be accurate, deterministic, and practical
- Extract ALL recipes if multiple are present
- Each ingredient needs: name, quantity (numeric), unit (or null)
- Calculate realistic nutrition per serving based on actual ingredients

SERVINGS RULE:
- Never assume servings unless clearly stated in the source
- Default to 1 serving if the source does not specify
- Every recipe MUST define serving size explicitly

DISCRETE FOODS RULE (For countable items like meatballs, patties, stuffed peppers):
- State total units made
- State how many units equal one serving
- Instructions must specify how many units to form
Example: "Makes 12 meatballs. 1 serving = 4 meatballs."

NUTRITION CALCULATION (per serving):
- Calculate based on actual ingredients and quantities
- Divide by servings to get per-serving values
- Calories must be accurate within ±2%
- Use standard nutrition databases knowledge

HEALTH RULES (Hard Constraints - only tag if fully compliant):
- Low Sodium: < 300 mg sodium per serving
- Kidney Friendly: < 400 mg sodium AND < 30 g protein per serving
- Diabetes Friendly: ≥ 5 g fiber AND < 40 g carbs per serving
- Heart Healthy: ≥ 5 g fiber AND < 300 mg sodium per serving

DIET RULES (Strict compliance required for tags):
- Keto: ≤ 8g net carbs, ≥ 60% calories from fat, ≤ 35% calories from protein
- Paleo: No grains, legumes, dairy, or refined oils
- Mediterranean: No red meat, processed foods, or refined grains
- Vegan: No animal products
- Vegetarian: No meat or fish
- Pescatarian: Fish allowed, no meat

EXTERNAL CONTENT INGESTION:
- Extract ingredients, cooking method, servings, and nutrition if available
- Reconstruct missing macros based on ingredients if unavoidable
- Normalize into the standard output structure
- Never copy raw content blindly

Always respond with valid JSON only, no markdown code blocks or explanation.`;
    
    const jsonFormat = `REQUIRED JSON structure (respond with ONLY this JSON, no markdown):
{
  "recipes": [
    {
      "title": "Recipe title",
      "description": "Brief description of the dish including what makes it special",
      "prep_time": 15,
      "cook_time": 30,
      "total_time": 45,
      "servings": 4,
      "serving_size": "1 cup" or "2 patties" or "1 plate",
      "difficulty": "easy|medium|hard",
      "cuisine": "American|Italian|Mexican|Asian|Mediterranean|Indian|Japanese|Thai|French|Greek|Brazilian",
      "is_kid_friendly": false,
      "is_meal_prep_friendly": true,
      "is_budget_friendly": true,
      "ingredients": [
        { "name": "ingredient name", "quantity": 2, "unit": "cups", "aisle": "produce" }
      ],
      "steps": [
        "Step 1 instruction with specific details",
        "Step 2 instruction"
      ],
      "nutrition": {
        "calories": 250,
        "protein_g": 12,
        "carbs_g": 3,
        "fat_g": 20,
        "fiber_g": 5,
        "sodium_mg": 180
      },
      "tags": ["lunch", "quick", "high-protein", "low-sodium", "keto"],
      "diet_tags": ["keto", "low-carb"],
      "health_tags": ["low-sodium", "heart-healthy"],
      "units_info": {
        "total_units": 12,
        "units_per_serving": 4,
        "unit_name": "meatballs"
      }
    }
  ]
}

CRITICAL RULES:
1. Extract ALL recipes from the document
2. Extract EVERY ingredient with exact quantities
3. Calculate accurate nutrition per serving
4. Default to 1 serving if not specified in source
5. For countable items (meatballs, patties, etc), include units_info
6. Only add diet_tags and health_tags if recipe FULLY complies with rules
7. Include serving_size as a human-readable portion description
8. If no recipes found, return: { "recipes": [], "error": "Could not extract recipe information" }`;

    // Build messages based on whether we have an image, document, or text
    let messages: any[] = [];
    let model = 'google/gemini-2.5-flash'; // Default to flash for text
    
    if (isImage && content && content.startsWith('data:image/')) {
      // For images, use vision capabilities
      model = 'google/gemini-2.5-pro';
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            {
              type: 'image_url',
              image_url: { url: content }
            },
            {
              type: 'text',
              text: `Extract ALL recipe information from this image.\n\n${jsonFormat}`
            }
          ]
        }
      ];
    } else if (isDocx && content) {
      // For DOCX files, extract text first (Gemini doesn't support DOCX MIME type)
      console.log('Extracting text from DOCX file...');
      const extractedText = await extractTextFromDocx(content);
      console.log(`Extracted text preview: ${extractedText.substring(0, 500)}...`);
      
      const prompt = `Extract ALL recipes from the following document content.\n\n${jsonFormat}\n\nDocument content:\n${extractedText}`;
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    } else if (isPdf && content) {
      // For PDFs, use vision capabilities (Gemini supports PDF)
      model = 'google/gemini-2.5-pro';
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            {
              type: 'image_url',
              image_url: { url: content }
            },
            {
              type: 'text',
              text: `This is a PDF document containing recipes. Extract ALL recipes from it.\n\n${jsonFormat}`
            }
          ]
        }
      ];
    } else if (sourceUrl && !content) {
      // For URLs, fetch the actual webpage content first
      console.log(`Fetching recipe from URL: ${sourceUrl}`);
      let webpageContent = '';
      
      try {
        const fetchResponse = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (fetchResponse.ok) {
          webpageContent = await fetchResponse.text();
          console.log(`Fetched ${webpageContent.length} characters from URL`);
          
          // Clean HTML to reduce token usage - extract text from body
          // Remove scripts, styles, comments, and excessive whitespace
          webpageContent = webpageContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
            // Keep structural tags but limit size
            .substring(0, 150000); // Limit to ~150KB
          
          console.log(`Cleaned HTML to ${webpageContent.length} characters`);
        } else {
          console.warn(`Failed to fetch URL: ${fetchResponse.status}`);
          webpageContent = `URL: ${sourceUrl} (could not fetch content, status: ${fetchResponse.status})`;
        }
      } catch (fetchErr) {
        console.warn('Error fetching URL:', fetchErr);
        webpageContent = `URL: ${sourceUrl} (could not fetch content)`;
      }
      
      const prompt = `Extract ALL recipes from the following webpage content. Pay close attention to the EXACT ingredients listed on the page.\n\n${jsonFormat}\n\nWebpage from ${sourceUrl}:\n${webpageContent}`;
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    } else {
      // For text content
      const prompt = `Extract ALL recipes from the following content.\n\n${jsonFormat}\n\nContent:\n${content || 'No content provided'}`;
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    }
    
    console.log(`Calling AI with model: ${model}`);
    const aiStartTime = Date.now();
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout (edge functions have 60s limit)
    
    let aiResponse;
    try {
      aiResponse = await fetch(LOVABLE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('AI request timed out. Please try with a smaller file or simpler recipe.');
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    console.log(`AI response received in ${Date.now() - aiStartTime}ms`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI response preview:', aiContent.substring(0, 300));

    // Parse the JSON response
    let parsedRecipes;
    try {
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedRecipes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!parsedRecipes || !Array.isArray(parsedRecipes.recipes)) {
      console.error('Invalid AI response structure:', JSON.stringify(parsedRecipes).substring(0, 200));
      throw new Error('Invalid AI response: missing recipes array');
    }

    // For seedGlobal mode, we don't need an upload record
    let ownerUserId: string | null = null;
    
    if (seedGlobal) {
      // Global recipes have no owner
      ownerUserId = null;
      console.log('Seed global mode: creating global recipes with no owner');
    } else {
      // Get the upload to find owner
      const { data: upload } = await supabase
        .from('uploads')
        .select('owner_user_id')
        .eq('id', uploadId)
        .single();

      if (!upload) {
        throw new Error('Upload not found');
      }

      // ========== OWNERSHIP VERIFICATION ==========
      if (upload.owner_user_id !== userId) {
        console.error(`Ownership mismatch: upload owner ${upload.owner_user_id} vs authenticated user ${userId}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden: You do not own this upload' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      ownerUserId = upload.owner_user_id;
    }

    console.log(`Found ${parsedRecipes.recipes.length} recipes to save`);

    // Save all recipes in parallel for speed
    const recipePromises = parsedRecipes.recipes.map(async (recipe: any) => {
      if (!recipe.title || typeof recipe.title !== 'string') {
        console.warn('Skipping recipe with invalid title');
        return null;
      }
      
      // Sanitize fields
      const sanitizedTitle = recipe.title.trim().substring(0, 200);
      const sanitizedDescription = typeof recipe.description === 'string' 
        ? recipe.description.trim().substring(0, 1000) 
        : null;
      const sanitizedCuisine = typeof recipe.cuisine === 'string'
        ? recipe.cuisine.trim().substring(0, 50)
        : null;
      
      const sanitizedServings = (typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 100)
        ? Math.round(recipe.servings) : 4;
      const sanitizedPrepTime = (typeof recipe.prep_time === 'number' && recipe.prep_time >= 0 && recipe.prep_time <= 1440)
        ? Math.round(recipe.prep_time) : null;
      const sanitizedCookTime = (typeof recipe.cook_time === 'number' && recipe.cook_time >= 0 && recipe.cook_time <= 1440)
        ? Math.round(recipe.cook_time) : null;
      const sanitizedTotalTime = (typeof recipe.total_time === 'number' && recipe.total_time >= 0 && recipe.total_time <= 2880)
        ? Math.round(recipe.total_time) : ((sanitizedPrepTime || 0) + (sanitizedCookTime || 0)) || null;
      
      const validDifficulties = ['easy', 'medium', 'hard'];
      const sanitizedDifficulty = validDifficulties.includes(recipe.difficulty) ? recipe.difficulty : 'medium';

      // Insert recipe with enhanced fields
      const sanitizedServingSize = typeof recipe.serving_size === 'string'
        ? recipe.serving_size.trim().substring(0, 100)
        : null;
      
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          owner_user_id: ownerUserId,
          title: sanitizedTitle,
          description: sanitizedDescription,
          prep_time: sanitizedPrepTime,
          cook_time: sanitizedCookTime,
          total_time: sanitizedTotalTime,
          servings: sanitizedServings,
          difficulty: sanitizedDifficulty,
          cuisine: sanitizedCuisine,
          scope: seedGlobal ? 'global' : 'private',
          is_kid_friendly: typeof recipe.is_kid_friendly === 'boolean' ? recipe.is_kid_friendly : false,
          is_meal_prep_friendly: typeof recipe.is_meal_prep_friendly === 'boolean' ? recipe.is_meal_prep_friendly : false,
          is_budget_friendly: typeof recipe.is_budget_friendly === 'boolean' ? recipe.is_budget_friendly : false,
        })
        .select()
        .single();

      if (recipeError) {
        console.error('Error creating recipe:', recipeError);
        return null;
      }

      // Insert related data in parallel
      const relatedPromises = [];

      // Ingredients
      if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        const validIngredients = recipe.ingredients
          .filter((ing: any) => ing && typeof ing.name === 'string' && ing.name.trim())
          .slice(0, 100)
          .map((ing: any, idx: number) => ({
            recipe_id: newRecipe.id,
            name: ing.name.trim().substring(0, 200),
            quantity: (typeof ing.quantity === 'number' && ing.quantity >= 0 && ing.quantity <= 10000) ? ing.quantity : null,
            unit: typeof ing.unit === 'string' ? ing.unit.trim().substring(0, 50) : null,
            order_index: idx,
          }));
        
        if (validIngredients.length > 0) {
          relatedPromises.push(supabase.from('recipe_ingredients').insert(validIngredients));
        }
      }

      // Steps
      if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
        const validSteps = recipe.steps
          .filter((step: any) => typeof step === 'string' && step.trim())
          .slice(0, 50)
          .map((step: string, idx: number) => ({
            recipe_id: newRecipe.id,
            step_number: idx + 1,
            instruction: step.trim().substring(0, 2000),
          }));
        
        if (validSteps.length > 0) {
          relatedPromises.push(supabase.from('recipe_steps').insert(validSteps));
        }
      }

      // Nutrition
      const validateNutrition = (val: any, max: number): number | null => {
        if (typeof val === 'number' && val >= 0 && val <= max) {
          return Math.round(val * 10) / 10;
        }
        return null;
      };
      
      relatedPromises.push(supabase.from('recipe_nutrition').insert({
        recipe_id: newRecipe.id,
        calories: validateNutrition(recipe.nutrition?.calories, 10000),
        protein_g: validateNutrition(recipe.nutrition?.protein_g, 1000),
        carbs_g: validateNutrition(recipe.nutrition?.carbs_g, 1000),
        fat_g: validateNutrition(recipe.nutrition?.fat_g, 1000),
        fiber_g: validateNutrition(recipe.nutrition?.fiber_g, 500),
        sodium_mg: validateNutrition(recipe.nutrition?.sodium_mg, 50000),
      }));

      // Tags - combine general tags, diet_tags, and health_tags
      const allTags: { recipe_id: string; tag_type: string; tag_value: string }[] = [];
      
      // General tags (meal type, quick, etc.)
      if (Array.isArray(recipe.tags)) {
        recipe.tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 20)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'meal',
              tag_value: tag.trim().substring(0, 50),
            });
          });
      }
      
      // Diet tags (keto, paleo, vegan, etc.)
      if (Array.isArray(recipe.diet_tags)) {
        recipe.diet_tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 10)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'diet',
              tag_value: tag.trim().toLowerCase().substring(0, 50),
            });
          });
      }
      
      // Health tags (low-sodium, heart-healthy, etc.)
      if (Array.isArray(recipe.health_tags)) {
        recipe.health_tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 10)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'health',
              tag_value: tag.trim().toLowerCase().substring(0, 50),
            });
          });
      }
      
      if (allTags.length > 0) {
        relatedPromises.push(supabase.from('recipe_tags').insert(allTags));
      }

      // Link upload to recipe (skip for seedGlobal mode)
      if (!seedGlobal && uploadId) {
        relatedPromises.push(supabase.from('upload_recipe_links').insert({
          upload_id: uploadId,
          recipe_id: newRecipe.id,
        }));
      }

      await Promise.all(relatedPromises);
      
      return { id: newRecipe.id, title: sanitizedTitle, description: sanitizedDescription };
    });

    const results = await Promise.all(recipePromises);
    const createdRecipes = results.filter(r => r !== null) as { id: string; title: string; description: string | null }[];

    console.log(`Successfully saved ${createdRecipes.length} recipes in ${Date.now() - aiStartTime}ms total`);

    // Update upload status (skip for seedGlobal mode)
    if (!seedGlobal && uploadId) {
      const recipesCount = createdRecipes.length;
      if (recipesCount === 1 && createdRecipes[0]?.title) {
        await supabase.from('uploads').update({
          status: 'parsed',
          parsed_text: aiContent,
          file_name: createdRecipes[0].title,
        }).eq('id', uploadId);
      } else {
        await supabase.from('uploads').update({
          status: 'parsed',
          parsed_text: aiContent,
        }).eq('id', uploadId);
      }
    }

    // Generate images in background AFTER returning response
    if (createdRecipes.length > 0) {
      EdgeRuntime.waitUntil(
        generateRecipeImagesInBackground(createdRecipes, supabaseUrl, supabaseServiceKey, LOVABLE_API_KEY)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipes: createdRecipes,
        count: createdRecipes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error parsing recipe:', errorMessage);
    
    try {
      const { uploadId } = await req.clone().json();
      if (uploadId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('uploads').update({
          status: 'failed',
          error_message: errorMessage,
        }).eq('id', uploadId);
      }
    } catch (e) {
      console.error('Failed to update upload status:', e);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
