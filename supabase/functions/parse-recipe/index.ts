import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import JSZip from 'https://esm.sh/jszip@3.10.1';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// YouTube channel/playlist URL patterns
const YOUTUBE_CHANNEL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/i,           // @username format
  /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/i,   // /channel/ID format
  /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/i,         // /c/name format (legacy)
  /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/i,      // /user/name format (legacy)
];

const YOUTUBE_PLAYLIST_PATTERN = /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=([\w-]+)/i;

// Extract channel ID from various YouTube channel URL formats
async function getYouTubeChannelId(url: string, apiKey: string): Promise<string | null> {
  try {
    // Direct channel ID format
    const channelIdMatch = url.match(/\/channel\/([\w-]+)/i);
    if (channelIdMatch) {
      return channelIdMatch[1];
    }

    // For @username, /c/, or /user/ formats, we need to resolve via API
    const handleMatch = url.match(/@([\w-]+)/);
    const customMatch = url.match(/\/c\/([\w-]+)/i);
    const userMatch = url.match(/\/user\/([\w-]+)/i);
    
    const identifier = handleMatch?.[1] || customMatch?.[1] || userMatch?.[1];
    if (!identifier) return null;

    // Use YouTube Data API to resolve handle to channel ID
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(identifier)}&key=${apiKey}&maxResults=1`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.warn('YouTube API search failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.items?.[0]?.snippet?.channelId || null;
  } catch (err) {
    console.error('Error resolving YouTube channel ID:', err);
    return null;
  }
}

// Get videos from a YouTube channel (up to maxResults)
async function getChannelVideos(channelId: string, apiKey: string, maxResults = 20): Promise<string[]> {
  try {
    // First get the uploads playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const channelResponse = await fetch(channelUrl);
    if (!channelResponse.ok) {
      console.warn('YouTube API channel fetch failed:', channelResponse.status);
      return [];
    }
    
    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.warn('Could not find uploads playlist for channel');
      return [];
    }

    return await getPlaylistVideos(uploadsPlaylistId, apiKey, maxResults);
  } catch (err) {
    console.error('Error fetching channel videos:', err);
    return [];
  }
}

// Get videos from a YouTube playlist
async function getPlaylistVideos(playlistId: string, apiKey: string, maxResults = 20): Promise<string[]> {
  try {
    const videoUrls: string[] = [];
    let pageToken = '';
    
    while (videoUrls.length < maxResults) {
      const remaining = maxResults - videoUrls.length;
      const fetchCount = Math.min(remaining, 50); // API max is 50 per request
      
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${fetchCount}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        console.warn('YouTube API playlist fetch failed:', response.status);
        break;
      }
      
      const data = await response.json();
      
      for (const item of data.items || []) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (videoId) {
          videoUrls.push(`https://www.youtube.com/watch?v=${videoId}`);
        }
      }
      
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    
    return videoUrls.slice(0, maxResults);
  } catch (err) {
    console.error('Error fetching playlist videos:', err);
    return [];
  }
}

// Check if URL is a YouTube channel or playlist
function isYouTubeChannelOrPlaylist(url: string): 'channel' | 'playlist' | null {
  if (YOUTUBE_CHANNEL_PATTERNS.some(pattern => pattern.test(url))) {
    return 'channel';
  }
  if (YOUTUBE_PLAYLIST_PATTERN.test(url)) {
    return 'playlist';
  }
  return null;
}

// Background image generation - runs after response is sent
async function generateRecipeImagesInBackground(
  recipeIds: { id: string; title: string; description: string | null }[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  geminiApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  
  // Generate images in parallel (max 3 at a time to avoid rate limits)
  const batchSize = 3;
  for (let i = 0; i < recipeIds.length; i += batchSize) {
    const batch = recipeIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (recipe) => {
      try {
        console.log(`Generating image for recipe: ${recipe.title}`);
        
        // Image prompt following strict guidelines
        const imagePrompt = `Professional food photography of a home-cooked ${recipe.title}. ${recipe.description || ''}
Final plated dish only. Realistic home-cooked appearance. Match the actual ingredients and portions from the recipe.
No text, no extra garnish or props not in the recipe. Natural lighting, overhead or 45-degree angle, clean simple background, appetizing presentation.
16:9 aspect ratio, high-quality food photography style.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
          generationConfig: {
            responseModalities: ['image', 'text'],
          } as any,
        });

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if ((part as any).inlineData) {
            const imageData = (part as any).inlineData;
            const base64Data = imageData.data;
            const mimeType = imageData.mimeType || 'image/png';
            const generatedImageUrl = `data:${mimeType};base64,${base64Data}`;
            
            await supabase.from('recipes').update({
              image_url: generatedImageUrl
            }).eq('id', recipe.id);
            console.log(`Image saved for: ${recipe.title}`);
            break;
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
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    
    // Parse body first to check for _seedKey
    const body = await req.json();
    const { uploadId, content, sourceUrl, fileType, isImage, title, filters, seedGlobal, _seedKey } = body;
    
    // Check for admin seeding access via _seedKey
    const isAdminSeed = _seedKey && _seedKey === GEMINI_API_KEY;
    
    // Also allow internal seeding via special header (for Lovable agent calls)
    const internalSeedHeader = req.headers.get('X-Lovable-Internal-Seed');
    const isInternalSeed = internalSeedHeader === 'true' && seedGlobal === true;
    
    if (!isAdminSeed && !isInternalSeed && !authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader?.replace('Bearer ', '') || '';
    
    // Check if this is a service-role request for seeding global recipes
    const isServiceRole = token === supabaseServiceKey;
    
    // Allow seeding if: service-role OR valid _seedKey OR internal seed header
    const canSeedGlobal = isServiceRole || isAdminSeed || isInternalSeed;
    
    let userId: string | null = null;
    
    if (canSeedGlobal && seedGlobal) {
      // Admin seeding access - for creating global recipes
      console.log('Admin seeding access: creating global recipes');
    } else if (isServiceRole) {
      // Service role access without seedGlobal flag
      console.log('Service role access');
    } else {
      // Regular user authentication
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader! } }
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

    // ========== SEED GLOBAL MODE VALIDATION ==========
    // If seedGlobal is true, admin access is required and uploadId is optional
    if (seedGlobal && !canSeedGlobal) {
      console.error('Seed global mode requires admin authentication');
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: seedGlobal requires admin access' }),
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

    // Build filter context for recipes (applies to both user-generated and seeded)
    let filterContext = '';
    if (filters) {
      if (filters.max_time) filterContext += `Max cooking time: ${filters.max_time} minutes. `;
      if (filters.meal_type) filterContext += `Meal type: ${filters.meal_type}. `;
      if (filters.cuisine) filterContext += `Cuisine: ${filters.cuisine}. `;
      if (filters.diet_type) filterContext += `Diet: ${filters.diet_type}. `;
      if (filters.allergies?.length) filterContext += `ALLERGIES (STRICT EXCLUSION): ${filters.allergies.join(', ')}. `;
      if (filters.dislikes?.length) filterContext += `DISLIKES (AVOID): ${filters.dislikes.join(', ')}. `;
      if (filters.health?.length) filterContext += `Health considerations (ENFORCE RULES): ${filters.health.join(', ')}. `;
      if (filters.target_calories) filterContext += `Target calories: ${filters.target_calories} kcal per serving. `;
      if (filters.target_protein) filterContext += `Target protein: ${filters.target_protein}g per serving. `;
      if (filters.target_carbs) filterContext += `Target carbs: ${filters.target_carbs}g per serving. `;
      if (filters.target_fat) filterContext += `Target fat: ${filters.target_fat}g per serving. `;
    }

    // UNIFIED COMPREHENSIVE SYSTEM PROMPT
    const systemPrompt = `You are an AI expert in:
- Nutrition science and metabolic health
- Professional cooking and recipe engineering
- Macro calculation and meal scaling
- Meal prep workflows
- Normalizing meals from external sources

Your job is to generate or extract complete recipes that exactly match the filters and inputs provided by the Nutrition app, including macros, diet rules, allergies, dislikes, and health considerations.

Be accurate, deterministic, and practical. No fluff.

═══════════════════════════════════════════════════════════════
SOURCE OF TRUTH RULE (CRITICAL)
═══════════════════════════════════════════════════════════════
The Nutrition app provides structured filters.
If a value is provided by a filter, you must treat it as FINAL and must NOT modify it.

Only ask a clarification question if:
- A required value is missing
- AND it is not provided by any filter
- AND it materially affects the recipe

If all required inputs are present via filters, do not ask any questions.

═══════════════════════════════════════════════════════════════
APP FILTERS (AUTHORITATIVE INPUTS)
═══════════════════════════════════════════════════════════════
${filterContext || 'No filters provided - generate reasonable healthy defaults.'}

Time (max total cooking time): < 15 / < 30 / < 45 / < 60 min
Meal Type: Breakfast, Lunch, Dinner, Snack
Cuisine: American, Italian, Mexican, Asian, Mediterranean, Indian, Japanese, Thai, French, Greek, Brazilian
Diet Type: Vegetarian, Vegan, Pescatarian, Keto, Paleo, Mediterranean

Allergies (multi-select + custom):
- Dairy, Gluten, Nuts, Peanuts, Shellfish, Soy, Eggs, Fish
- Plus any custom allergy provided
YOU MUST STRICTLY EXCLUDE ALL SELECTED ALLERGENS.

Dislikes (multi-select + custom):
- Mushrooms, Onions, Garlic, Bell Peppers, Tomatoes, Cilantro, Olives, Spicy
- Plus any custom dislikes
YOU MUST AVOID THESE INGREDIENTS ENTIRELY.

═══════════════════════════════════════════════════════════════
HEALTH OPTIMIZATION (DEFAULT BEHAVIOR)
═══════════════════════════════════════════════════════════════
Unless a specific diet/filter requires otherwise, ALWAYS optimize for health:
- MINIMIZE sodium: Use minimal added salt (1/4 to 1/2 tsp total for 4 servings MAX)
- Target sodium: < 600mg per serving, < 500mg preferred
- Use fresh herbs, garlic, lemon, spices for flavor instead of salt
- Use lean proteins when appropriate (e.g., 90/10 ground beef over 80/20)
- Target calories: 400-600 kcal per serving for main dishes unless specified otherwise
- Balance macros: 25-35g protein, 20-30g fat, 35-45g carbs per serving for balanced meals
- Include vegetables and fiber sources when possible

═══════════════════════════════════════════════════════════════
HEALTH RULES (HARD CONSTRAINTS)
═══════════════════════════════════════════════════════════════
Only tag a meal if it FULLY complies:

Low Sodium: < 300 mg sodium per serving
Kidney Friendly: < 400 mg sodium AND < 30 g protein per serving
Diabetes Friendly: ≥ 5 g fiber AND < 40 g carbs per serving
Heart Healthy: ≥ 5 g fiber AND < 300 mg sodium per serving

═══════════════════════════════════════════════════════════════
DIET RULES (STRICT COMPLIANCE FOR TAGS)
═══════════════════════════════════════════════════════════════
Keto: ≤ 8g net carbs, ≥ 60% calories from fat, ≤ 35% calories from protein
Paleo: No grains, legumes, dairy, or refined oils
Mediterranean: No red meat, processed foods, or refined grains
Vegan: No animal products
Vegetarian: No meat or fish
Pescatarian: Fish allowed, no meat

═══════════════════════════════════════════════════════════════
MACRO RULES
═══════════════════════════════════════════════════════════════
If macros or calories are provided by the app:
- Treat them as HARD CONSTRAINTS
- Macros are per serving unless explicitly stated otherwise
- Calories must match within ±2%
- Never invent or modify provided macros

If macros are NOT provided:
- Generate reasonable macros consistent with the meal type and diet
- Main dishes: 400-600 kcal, 25-35g protein per serving
- Snacks: 150-300 kcal, 5-15g protein per serving

═══════════════════════════════════════════════════════════════
SERVINGS AND MEAL PREP RULES
═══════════════════════════════════════════════════════════════
- Never assume servings unless clearly stated
- Default to 4 servings for main dishes, 1 serving for snacks
- Every recipe MUST define serving size explicitly

SERVING SIZE DESCRIPTION (serving_size field):
The serving_size field describes what ONE SERVING equals in terms of the COMPLETED DISH.
Be SPECIFIC with actual piece counts - avoid generic descriptions.

CRITICAL CALCULATION RULES:
1. For countable protein items (chicken tenders, wings, drumsticks, meatballs, patties, nuggets):
   - Calculate: total quantity ÷ number of servings = pieces per serving
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders total ÷ 4 servings = "3 chicken tenders"
   - Example: "16 meatballs total" ÷ 4 servings = "4 meatballs"
   - Conversion: 1 lb raw chicken tenders ≈ 6-8 tenders

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use cooked weight per serving: "6 oz salmon" or "5 oz steak"

3. For non-countable items (soups, stews, rice dishes, salads):
   - Use volume: "1 cup soup" or "1.5 cups fried rice" or "1 bowl"

4. For multi-component dishes:
   - Combine protein count + sides: "3 chicken tenders + 1 cup vegetables"

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC.

DISCRETE FOODS RULE:
- State total units made in instructions (e.g., "Form into 16 meatballs")
- Calculate pieces per serving in serving_size (e.g., "4 meatballs")

MEAL PREP MAPPING:
- 1 container = 1 serving with explicit contents
Example: "1 container = 4 meatballs + 1 cup potatoes + 1/2 cup sauce"

═══════════════════════════════════════════════════════════════
PORTION CONTROL
═══════════════════════════════════════════════════════════════
- For meatballs/patties: 3-4 medium-sized (1.5 oz each) per serving
- For meat portions: 4-6 oz cooked per serving
- For starch portions: 1/2 to 1 cup per serving
- Main dish servings should be 400-600 kcal unless high-protein/athlete meal

═══════════════════════════════════════════════════════════════
EXTERNAL CONTENT INGESTION (URLs, images, documents)
═══════════════════════════════════════════════════════════════
If extracting from external content:
- Extract ingredients, cooking method, servings, and nutrition if available
- Reconstruct missing macros based on ingredients if unavoidable
- Normalize into the standard output structure
- Validate against filters, diet rules, allergies, dislikes, and health rules
- Never copy raw content blindly

═══════════════════════════════════════════════════════════════
TONE AND BEHAVIOR
═══════════════════════════════════════════════════════════════
- Direct and precise
- No motivational fluff
- Never guess
- If a filter combination is impossible, explain why and stop

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
      "serving_size": "Human-readable portion description (e.g., '1 bowl', '4 meatballs + 1.5 cups potatoes', '1 cup soup', '12 oz shake')",
      "difficulty": "easy|medium|hard",
      "cuisine": "American|Italian|Mexican|Asian|Mediterranean|Indian|Japanese|Thai|French|Greek|Brazilian",
      "is_kid_friendly": false,
      "is_meal_prep_friendly": true,
      "is_budget_friendly": true,
      "ingredients": [
        { "name": "ingredient name", "quantity": 2, "unit": "cups", "aisle": "Produce|Meat|Dairy|Bakery|Canned Goods|Spices|Oils|Health Foods|Frozen|Beverages" }
      ],
      "steps": [
        "Step 1 instruction with specific details",
        "Step 2 instruction including portion info for discrete items"
      ],
      "nutrition": {
        "calories": 485,
        "protein_g": 28,
        "carbs_g": 38,
        "fat_g": 24,
        "fiber_g": 5,
        "sodium_mg": 500,
        "sugar_g": 6,
        "saturated_fat_g": 8,
        "cholesterol_mg": 85
      },
      "tags": ["dinner", "high-protein", "meal-prep"],
      "diet_tags": ["mediterranean"],
      "health_tags": ["diabetes-friendly"],
      "units_info": {
        "total_units": 16,
        "units_per_serving": 4,
        "unit_name": "meatballs"
      },
      "meal_prep_info": "1 container = 4 meatballs + 1 cup potatoes + 1/2 cup sauce"
    }
  ]
}

CRITICAL RULES:
1. Extract ALL recipes from the document
2. Extract EVERY ingredient with exact quantities
3. Calculate ACCURATE nutrition per serving (calories ±2%)
4. Default to 4 servings for main dishes if not specified
5. For countable items (meatballs, patties, etc), include units_info
6. Only add diet_tags and health_tags if recipe FULLY complies with rules
7. Include serving_size as a human-readable portion description
8. MINIMIZE sodium by default (< 600mg unless health filter requires lower)
9. If no recipes found, return: { "recipes": [], "error": "Could not extract recipe information" }`;

    // Build prompt and call Gemini
    let promptText = '';
    let imageParts: any[] = [];
    let modelName = 'gemini-2.0-flash'; // Default to flash for text
    
    if (isImage && content && content.startsWith('data:image/')) {
      // For images, use vision capabilities
      modelName = 'gemini-2.0-flash';
      const mimeMatch = content.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const base64Data = content.replace(/^data:image\/[^;]+;base64,/, '');
      
      imageParts = [{
        inlineData: {
          mimeType,
          data: base64Data
        }
      }];
      promptText = `${systemPrompt}\n\nExtract ALL recipe information from this image.\n\n${jsonFormat}`;
    } else if (isDocx && content) {
      // For DOCX files, extract text first
      console.log('Extracting text from DOCX file...');
      const extractedText = await extractTextFromDocx(content);
      console.log(`Extracted text preview: ${extractedText.substring(0, 500)}...`);
      
      promptText = `${systemPrompt}\n\nExtract ALL recipes from the following document content.\n\n${jsonFormat}\n\nDocument content:\n${extractedText}`;
    } else if (isPdf && content) {
      // For PDFs, extract base64 and send to Gemini
      modelName = 'gemini-2.0-flash';
      const base64Data = content.replace(/^data:application\/pdf;base64,/, '');
      
      imageParts = [{
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      }];
      promptText = `${systemPrompt}\n\nThis is a PDF document containing recipes. Extract ALL recipes from it.\n\n${jsonFormat}`;
    } else if (sourceUrl && !content) {
      // Check if this is a YouTube channel or playlist
      const youtubeType = isYouTubeChannelOrPlaylist(sourceUrl);
      const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
      
      if (youtubeType && YOUTUBE_API_KEY) {
        // Handle YouTube channel or playlist
        console.log(`Processing YouTube ${youtubeType}: ${sourceUrl}`);
        
        let videoUrls: string[] = [];
        
        if (youtubeType === 'channel') {
          const channelId = await getYouTubeChannelId(sourceUrl, YOUTUBE_API_KEY);
          if (channelId) {
            console.log(`Resolved channel ID: ${channelId}`);
            videoUrls = await getChannelVideos(channelId, YOUTUBE_API_KEY, 20);
          } else {
            console.warn('Could not resolve YouTube channel ID');
          }
        } else if (youtubeType === 'playlist') {
          const playlistMatch = sourceUrl.match(YOUTUBE_PLAYLIST_PATTERN);
          if (playlistMatch?.[2]) {
            videoUrls = await getPlaylistVideos(playlistMatch[2], YOUTUBE_API_KEY, 20);
          }
        }
        
        if (videoUrls.length === 0) {
          throw new Error(`Could not find any videos in the YouTube ${youtubeType}. Make sure the channel/playlist is public.`);
        }
        
        console.log(`Found ${videoUrls.length} videos to process`);
        
        const videoList = videoUrls.slice(0, 10).map((url, i) => `Video ${i + 1}: ${url}`).join('\n');
        promptText = `${systemPrompt}\n\nProcess these YouTube cooking videos and extract ALL recipes from each video. Pay close attention to the EXACT ingredients and quantities mentioned in each video.\n\n${jsonFormat}\n\nVideos to process:\n${videoList}`;
      } else if (youtubeType && !YOUTUBE_API_KEY) {
        throw new Error('YouTube channel/playlist import requires the YOUTUBE_API_KEY to be configured.');
      } else {
        // Check if this is a single YouTube video URL
        const isYouTubeVideoUrl = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(sourceUrl);
        
        if (isYouTubeVideoUrl) {
          console.log(`Processing YouTube video: ${sourceUrl}`);
          promptText = `${systemPrompt}\n\nWatch this YouTube video and extract ALL recipes shown or described. Pay close attention to the EXACT ingredients and quantities mentioned.\n\n${jsonFormat}\n\nYouTube Video URL: ${sourceUrl}`;
        } else {
          // For regular URLs, fetch the actual webpage content first
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
              
              // Clean HTML to reduce token usage
              webpageContent = webpageContent
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
                .substring(0, 150000);
              
              console.log(`Cleaned HTML to ${webpageContent.length} characters`);
            } else {
              console.warn(`Failed to fetch URL: ${fetchResponse.status}`);
              webpageContent = `URL: ${sourceUrl} (could not fetch content, status: ${fetchResponse.status})`;
            }
          } catch (fetchErr) {
            console.warn('Error fetching URL:', fetchErr);
            webpageContent = `URL: ${sourceUrl} (could not fetch content)`;
          }
          
          promptText = `${systemPrompt}\n\nExtract ALL recipes from the following webpage content. Pay close attention to the EXACT ingredients listed on the page.\n\n${jsonFormat}\n\nWebpage from ${sourceUrl}:\n${webpageContent}`;
        }
      }
    } else {
      // For text content
      promptText = `${systemPrompt}\n\nExtract ALL recipes from the following content.\n\n${jsonFormat}\n\nContent:\n${content || 'No content provided'}`;
    }
    
    console.log(`Calling Gemini with model: ${modelName}`);
    const aiStartTime = Date.now();
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    let result;
    try {
      if (imageParts.length > 0) {
        result = await model.generateContent([promptText, ...imageParts]);
      } else {
        result = await model.generateContent(promptText);
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('AI request timed out. Please try with a smaller file or simpler recipe.');
      }
      throw fetchError;
    }

    console.log(`AI response received in ${Date.now() - aiStartTime}ms`);

    const aiContent = result.response.text();
    
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
          serving_size: sanitizedServingSize,
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
        generateRecipeImagesInBackground(createdRecipes, supabaseUrl, supabaseServiceKey, GEMINI_API_KEY)
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
