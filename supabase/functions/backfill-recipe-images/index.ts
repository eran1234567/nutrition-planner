import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { recipeIds } = body; // Optional: specific recipe IDs to backfill

    // Find recipes missing images for this user
    let query = supabase
      .from('recipes')
      .select('id, title, description')
      .eq('owner_user_id', userId)
      .eq('is_deleted', false)
      .or('image_url.is.null,image_url.eq.')
      .order('created_at', { ascending: false })
      .limit(10); // Process max 10 at a time

    if (recipeIds && Array.isArray(recipeIds) && recipeIds.length > 0) {
      query = query.in('id', recipeIds);
    }

    const { data: recipes, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to fetch recipes: ${queryError.message}`);
    }

    if (!recipes || recipes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No recipes missing images', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${recipes.length} recipes missing images`);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    let successCount = 0;
    let failedCount = 0;

    // Process one at a time to avoid rate limits
    for (const recipe of recipes) {
      try {
        console.log(`Generating image for: ${recipe.title}`);

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

        let imageGenerated = false;
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
            successCount++;
            imageGenerated = true;
            break;
          }
        }

        if (!imageGenerated) {
          console.warn(`No image generated for: ${recipe.title}`);
          failedCount++;
        }

        // Small delay between generations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`Failed to generate image for ${recipe.title}:`, err);
        failedCount++;

        // Check for rate limit error
        const errMsg = err instanceof Error ? err.message : String(err);
        if (/429|quota|rate.?limit/i.test(errMsg)) {
          console.warn('Rate limit hit, stopping batch');
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${successCount} images, ${failedCount} failed`,
        successCount,
        failedCount,
        total: recipes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
