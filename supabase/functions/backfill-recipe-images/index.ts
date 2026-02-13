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
    const { recipeIds, regenerateAll } = body;

    const batchSize = 50;
    const { offset = 0 } = body;
    
    let query = supabase
      .from('recipes')
      .select('id, title, description, image_url, owner_user_id, scope')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (recipeIds && Array.isArray(recipeIds) && recipeIds.length > 0) {
      query = query.in('id', recipeIds);
    } else if (regenerateAll) {
      query = query.or('scope.eq.global,owner_user_id.eq.' + userId);
    } else if (body.globalOnly) {
      query = query.eq('scope', 'global')
        .or('image_url.is.null,image_url.eq.,image_url.like.data:%');
    } else {
      query = query.eq('owner_user_id', userId)
        .or('image_url.is.null,image_url.eq.,image_url.like.data:%');
    }

    const { data: recipes, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to fetch recipes: ${queryError.message}`);
    }

    if (!recipes || recipes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No recipes to process', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${recipes.length} recipes to process`);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    let successCount = 0;
    let failedCount = 0;

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
            const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

            const ownerId = recipe.owner_user_id || 'global';
            const storagePath = `users/${ownerId}/recipes/${recipe.id}-${Date.now()}.jpg`;

            if (recipe.image_url && !recipe.image_url.startsWith('data:') && recipe.image_url.includes('/storage/v1/object/public/recipe-images/')) {
              const marker = '/storage/v1/object/public/recipe-images/';
              const oldPath = recipe.image_url.split(marker)[1]?.split('?')[0];
              if (oldPath) {
                await supabase.storage.from('recipe-images').remove([decodeURIComponent(oldPath)]);
              }
            }

            const { error: uploadError } = await supabase.storage
              .from('recipe-images')
              .upload(storagePath, binaryData, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              console.error(`Upload error for ${recipe.title}:`, uploadError);
              failedCount++;
              break;
            }

            const { data: urlData } = supabase.storage
              .from('recipe-images')
              .getPublicUrl(storagePath);

            const { error: updateError } = await supabase.from('recipes').update({
              image_url: urlData.publicUrl
            }).eq('id', recipe.id);

            if (updateError) {
              console.error(`DB update error for ${recipe.title}:`, updateError);
              failedCount++;
              break;
            }

            console.log(`Image uploaded to Storage for: ${recipe.title}`);
            successCount++;
            imageGenerated = true;
            break;
          }
        }

        if (!imageGenerated) {
          console.warn(`No image generated for: ${recipe.title}`);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (err) {
        console.error(`Failed to generate image for ${recipe.title}:`, err);
        failedCount++;

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
        nextOffset: recipes.length === batchSize ? offset + batchSize : null,
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
