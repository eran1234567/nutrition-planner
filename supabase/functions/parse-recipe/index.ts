import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { uploadId, content, sourceUrl, fileType, isImage } = await req.json();

    // ========== INPUT VALIDATION ==========
    
    // 1. Validate uploadId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uploadId || typeof uploadId !== 'string' || !uuidRegex.test(uploadId)) {
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

    // 3. Validate image format if isImage flag is set
    if (isImage && content) {
      const validImagePattern = /^data:image\/(jpeg|jpg|png|gif|webp|heic);base64,/i;
      if (typeof content !== 'string' || !validImagePattern.test(content)) {
        console.error('Invalid image format');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid image format. Supported: JPEG, PNG, GIF, WebP' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

    // 5. Validate text content length (max 100KB for text)
    const MAX_TEXT_SIZE = 100_000; // 100KB
    if (!isImage && content && typeof content === 'string' && content.length > MAX_TEXT_SIZE) {
      console.error('Text content too large:', content.length);
      return new Response(
        JSON.stringify({ success: false, error: 'Text content exceeds maximum size of 100KB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing upload ${uploadId}, type: ${fileType}, isImage: ${isImage}`);

    // Update status to parsing
    await supabase.from('uploads').update({ status: 'parsing' }).eq('id', uploadId);

    // Build the prompt based on content type
    const systemPrompt = `You are an expert recipe extraction and nutrition calculation AI. Your job is to:
1. Extract EVERY ingredient with exact quantities and units from the recipe
2. Calculate accurate nutrition per serving based on the ingredients
3. Always respond with valid JSON only, no markdown code blocks or explanation.

CRITICAL: You MUST extract ALL ingredients visible in the recipe. Each ingredient needs:
- name: the ingredient name (e.g., "eggs", "mayonnaise", "green onions")
- quantity: numeric amount (e.g., 4, 0.5, 2)
- unit: measurement unit (e.g., "large", "tablespoons", "cups", "pieces", or null if just a count)

For nutrition calculation:
- Calculate based on the actual ingredients and quantities
- Divide by servings to get per-serving values
- Use standard nutrition databases knowledge for common ingredients`;
    
    const jsonFormat = `REQUIRED JSON structure (respond with ONLY this JSON, no markdown):
{
  "recipes": [
    {
      "title": "Recipe title",
      "description": "Brief description of the dish",
      "prep_time": 15,
      "cook_time": 30,
      "total_time": 45,
      "servings": 4,
      "difficulty": "easy|medium|hard",
      "cuisine": "American|Italian|Mexican|Asian|etc",
      "ingredients": [
        { "name": "hard boiled eggs", "quantity": 4, "unit": "large" },
        { "name": "mayonnaise", "quantity": 2, "unit": "tablespoons" },
        { "name": "green onions", "quantity": 2, "unit": "stalks" }
      ],
      "steps": [
        "Step 1 instruction",
        "Step 2 instruction"
      ],
      "nutrition": {
        "calories": 250,
        "protein_g": 12,
        "carbs_g": 3,
        "fat_g": 20,
        "fiber_g": 0,
        "sodium_mg": 180
      },
      "tags": ["lunch", "quick", "high-protein"]
    }
  ]
}

IMPORTANT: 
- Extract EVERY single ingredient mentioned, even if quantity is not explicitly stated (estimate reasonable amounts)
- Calculate realistic nutrition values based on the actual ingredients
- If servings not specified, estimate based on recipe size (typically 2-4)
- If you cannot find recipe information, return: { "recipes": [], "error": "Could not extract recipe information" }`;

    // Build messages based on whether we have an image or text
    let messages: any[] = [];
    
    if (isImage && content && content.startsWith('data:image/')) {
      // For images, use vision capabilities with multimodal message
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            {
              type: 'image_url',
              image_url: {
                url: content
              }
            },
            {
              type: 'text',
              text: `CAREFULLY extract ALL recipe information from this image.

CRITICAL TASKS:
1. Read EVERY ingredient listed - include the exact quantity and unit for each
2. Read ALL cooking instructions/steps
3. Calculate accurate nutrition per serving based on the ingredients you extract
4. Identify the recipe title, servings count, and cooking times if visible

${jsonFormat}`
            }
          ]
        }
      ];
    } else {
      // For text content
      const prompt = `Extract recipe information from the following content and return it as JSON.

${jsonFormat}

Content to analyze:
${content || sourceUrl || 'No content provided'}`;
      
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    }

    // Call Lovable AI - use gemini-2.5-pro for images (better vision) or flash for text
    const model = isImage ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
    
    const aiResponse = await fetch(LOVABLE_API_URL, {
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
    });

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

    console.log('AI response received:', aiContent.substring(0, 200));

    // Parse the JSON response
    let parsedRecipes;
    try {
      // Remove markdown code blocks if present
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedRecipes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // ========== VALIDATE AI OUTPUT STRUCTURE ==========
    if (!parsedRecipes || typeof parsedRecipes !== 'object') {
      throw new Error('Invalid AI response: not an object');
    }
    
    if (!Array.isArray(parsedRecipes.recipes)) {
      console.error('Invalid AI response structure:', JSON.stringify(parsedRecipes).substring(0, 200));
      throw new Error('Invalid AI response: missing recipes array');
    }

    // Get the upload to find owner
    const { data: upload } = await supabase
      .from('uploads')
      .select('owner_user_id')
      .eq('id', uploadId)
      .single();

    if (!upload) {
      throw new Error('Upload not found');
    }

    // Save recipes to database
    const createdRecipes = [];
    for (const recipe of parsedRecipes.recipes) {
      // ========== VALIDATE AND SANITIZE EACH RECIPE ==========
      
      // Validate required title field
      if (!recipe.title || typeof recipe.title !== 'string') {
        console.warn('Skipping recipe with invalid title');
        continue;
      }
      
      // Sanitize string fields (max lengths)
      const sanitizedTitle = recipe.title.trim().substring(0, 200);
      const sanitizedDescription = typeof recipe.description === 'string' 
        ? recipe.description.trim().substring(0, 1000) 
        : null;
      const sanitizedCuisine = typeof recipe.cuisine === 'string'
        ? recipe.cuisine.trim().substring(0, 50)
        : null;
      
      // Validate and sanitize numeric fields
      const sanitizedServings = (typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 100)
        ? Math.round(recipe.servings)
        : 4;
      const sanitizedPrepTime = (typeof recipe.prep_time === 'number' && recipe.prep_time >= 0 && recipe.prep_time <= 1440)
        ? Math.round(recipe.prep_time)
        : null;
      const sanitizedCookTime = (typeof recipe.cook_time === 'number' && recipe.cook_time >= 0 && recipe.cook_time <= 1440)
        ? Math.round(recipe.cook_time)
        : null;
      const sanitizedTotalTime = (typeof recipe.total_time === 'number' && recipe.total_time >= 0 && recipe.total_time <= 2880)
        ? Math.round(recipe.total_time)
        : ((sanitizedPrepTime || 0) + (sanitizedCookTime || 0)) || null;
      
      // Validate difficulty
      const validDifficulties = ['easy', 'medium', 'hard'];
      const sanitizedDifficulty = validDifficulties.includes(recipe.difficulty) 
        ? recipe.difficulty 
        : 'medium';
      // Insert recipe with sanitized data
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          owner_user_id: upload.owner_user_id,
          title: sanitizedTitle,
          description: sanitizedDescription,
          prep_time: sanitizedPrepTime,
          cook_time: sanitizedCookTime,
          total_time: sanitizedTotalTime,
          servings: sanitizedServings,
          difficulty: sanitizedDifficulty,
          cuisine: sanitizedCuisine,
          scope: 'private',
        })
        .select()
        .single();

      if (recipeError) {
        console.error('Error creating recipe:', recipeError);
        continue;
      }

      createdRecipes.push(newRecipe);

      // Insert ingredients with validation
      if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        const validIngredients = recipe.ingredients
          .filter((ing: any) => ing && typeof ing.name === 'string' && ing.name.trim())
          .slice(0, 100) // Max 100 ingredients per recipe
          .map((ing: any, idx: number) => ({
            recipe_id: newRecipe.id,
            name: ing.name.trim().substring(0, 200),
            quantity: (typeof ing.quantity === 'number' && ing.quantity >= 0 && ing.quantity <= 10000) 
              ? ing.quantity 
              : null,
            unit: typeof ing.unit === 'string' ? ing.unit.trim().substring(0, 50) : null,
            order_index: idx,
          }));
        
        if (validIngredients.length > 0) {
          console.log(`Inserting ${validIngredients.length} ingredients for recipe ${newRecipe.id}`);
          const { error: ingError } = await supabase.from('recipe_ingredients').insert(validIngredients);
          if (ingError) {
            console.error('Error inserting ingredients:', ingError);
          }
        }
      } else {
        console.warn(`No valid ingredients found for recipe ${sanitizedTitle}`);
      }

      // Insert steps with validation
      if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
        const validSteps = recipe.steps
          .filter((step: any) => typeof step === 'string' && step.trim())
          .slice(0, 50) // Max 50 steps per recipe
          .map((step: string, idx: number) => ({
            recipe_id: newRecipe.id,
            step_number: idx + 1,
            instruction: step.trim().substring(0, 2000),
          }));
        
        if (validSteps.length > 0) {
          await supabase.from('recipe_steps').insert(validSteps);
        }
      }

      // Insert nutrition with validation - always create a record even if values are partial
      const validateNutrition = (val: any, max: number): number | null => {
        if (typeof val === 'number' && val >= 0 && val <= max) {
          return Math.round(val * 10) / 10; // Round to 1 decimal
        }
        return null;
      };
      
      const nutritionData = {
        recipe_id: newRecipe.id,
        calories: validateNutrition(recipe.nutrition?.calories, 10000),
        protein_g: validateNutrition(recipe.nutrition?.protein_g, 1000),
        carbs_g: validateNutrition(recipe.nutrition?.carbs_g, 1000),
        fat_g: validateNutrition(recipe.nutrition?.fat_g, 1000),
        fiber_g: validateNutrition(recipe.nutrition?.fiber_g, 500),
        sodium_mg: validateNutrition(recipe.nutrition?.sodium_mg, 50000),
      };
      
      const { error: nutritionError } = await supabase.from('recipe_nutrition').insert(nutritionData);
      if (nutritionError) {
        console.error('Error inserting nutrition:', nutritionError);
      } else {
        console.log('Nutrition inserted for recipe:', sanitizedTitle);
      }

      // Insert tags with validation
      if (Array.isArray(recipe.tags) && recipe.tags.length > 0) {
        const validTags = recipe.tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 20) // Max 20 tags per recipe
          .map((tag: string) => ({
            recipe_id: newRecipe.id,
            tag_type: 'meal',
            tag_value: tag.trim().substring(0, 50),
          }));
        
        if (validTags.length > 0) {
          await supabase.from('recipe_tags').insert(validTags);
        }
      }

      // Link upload to recipe
      await supabase.from('upload_recipe_links').insert({
        upload_id: uploadId,
        recipe_id: newRecipe.id,
      });

      // Generate an image for the recipe using AI
      try {
        console.log(`Generating image for recipe: ${recipe.title}`);
        
        const imagePrompt = `Professional food photography of ${recipe.title}. ${recipe.description || ''} 
Beautiful plated dish, overhead angle, natural lighting, appetizing presentation, high-quality food photography style, 16:9 aspect ratio.`;

        const imageResponse = await fetch(LOVABLE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: imagePrompt
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImageUrl) {
            // Update recipe with the generated image
            await supabase.from('recipes').update({
              image_url: generatedImageUrl
            }).eq('id', newRecipe.id);
            
            console.log(`Image generated and saved for recipe: ${recipe.title}`);
          }
        } else {
          console.error('Failed to generate image:', await imageResponse.text());
        }
      } catch (imgError) {
        console.error('Error generating recipe image:', imgError);
        // Continue without image - not a critical failure
      }
    }

    // Rename upload file based on parsed recipes
    // If single recipe: rename to recipe title
    // If multiple recipes: keep original file name
    const recipesCount = createdRecipes.length;
    if (recipesCount === 1 && createdRecipes[0]?.title) {
      // Single recipe - rename file to recipe title
      const recipeTitle = createdRecipes[0].title;
      await supabase.from('uploads').update({
        status: 'parsed',
        parsed_text: aiContent,
        file_name: recipeTitle,
      }).eq('id', uploadId);
      console.log(`Renamed upload to single recipe title: "${recipeTitle}"`);
    } else {
      // Multiple recipes or no recipes - keep original file name
      await supabase.from('uploads').update({
        status: 'parsed',
        parsed_text: aiContent,
      }).eq('id', uploadId);
      console.log(`Kept original file name (${recipesCount} recipes extracted)`);
    }

    console.log(`Successfully parsed ${createdRecipes.length} recipes`);

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
    
    // Try to update upload status to failed
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
