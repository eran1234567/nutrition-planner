import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal-seed',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal seed header for admin access
    const internalHeader = req.headers.get('X-Lovable-Internal-Seed');
    if (internalHeader !== 'true') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { batchSize = 5, dryRun = false } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find recipes missing extended nutrition data - direct SQL-like query
    const { data: recipesToBackfill, error: fetchError } = await supabase
      .from('recipe_nutrition')
      .select(`
        id,
        recipe_id,
        sugar_g,
        saturated_fat_g,
        cholesterol_mg,
        recipes!inner(id, title, servings, scope, is_deleted),
        recipe:recipe_id(recipe_ingredients(name, quantity, unit))
      `)
      .eq('recipes.scope', 'global')
      .eq('recipes.is_deleted', false)
      .or('sugar_g.is.null,saturated_fat_g.is.null,cholesterol_mg.is.null')
      .limit(batchSize);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Failed to fetch recipes: ${fetchError.message}`);
    }

    if (!recipesToBackfill || recipesToBackfill.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No recipes with missing nutrition data found',
        processed: 0,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${recipesToBackfill.length} recipes to backfill`);

    const results: Array<{ id: string; title: string; status: string; data?: any }> = [];

    for (const nutritionRow of recipesToBackfill) {
      const recipe = nutritionRow.recipes as any;
      const recipeWithIngredients = nutritionRow.recipe as any;
      const ingredients = recipeWithIngredients?.recipe_ingredients || [];
      
      try {
        const ingredientList = ingredients
          .map((i: any) => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim())
          .join(', ');

        if (!ingredientList) {
          results.push({ id: recipe.id, title: recipe.title, status: 'skipped', data: { reason: 'No ingredients' } });
          continue;
        }

        console.log(`Processing: ${recipe.title}`);

        // Use AI to estimate missing nutrition values
        const aiResponse = await fetch(LOVABLE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: `You are a nutrition expert. Given a recipe and its ingredients, estimate TOTAL values for the ENTIRE recipe (not per serving). Return ONLY a JSON object:
{"sugar_g": <number>, "saturated_fat_g": <number>, "cholesterol_mg": <number>}

Examples:
- 1 tbsp sugar = 12g sugar
- 1 egg = 186mg cholesterol, 1.6g saturated fat
- Vegan = 0 cholesterol
No explanation, just JSON.`
              },
              {
                role: 'user',
                content: `${recipe.title}: ${ingredientList}`
              }
            ],
            temperature: 0.1,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI error for ${recipe.title}:`, errorText);
          throw new Error(`AI API error: ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        console.log(`AI response for ${recipe.title}:`, content);

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in AI response');
        }

        const nutritionEstimate = JSON.parse(jsonMatch[0]);
        
        // Calculate per-serving values
        const servings = recipe.servings || 4;
        const perServingData = {
          sugar_g: Math.round((nutritionEstimate.sugar_g || 0) / servings * 10) / 10,
          saturated_fat_g: Math.round((nutritionEstimate.saturated_fat_g || 0) / servings * 10) / 10,
          cholesterol_mg: Math.round((nutritionEstimate.cholesterol_mg || 0) / servings),
        };

        if (dryRun) {
          results.push({ 
            id: recipe.id, 
            title: recipe.title, 
            status: 'dry-run', 
            data: { total: nutritionEstimate, perServing: perServingData }
          });
        } else {
          // Update the nutrition record
          const { error: updateError } = await supabase
            .from('recipe_nutrition')
            .update(perServingData)
            .eq('id', nutritionRow.id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          console.log(`Updated ${recipe.title}:`, perServingData);
          results.push({ 
            id: recipe.id, 
            title: recipe.title, 
            status: 'updated', 
            data: perServingData 
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (recipeError) {
        console.error(`Error processing ${recipe?.title}:`, recipeError);
        results.push({ 
          id: recipe?.id, 
          title: recipe?.title, 
          status: 'error', 
          data: { error: String(recipeError) }
        });
      }
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from('recipe_nutrition')
      .select('id', { count: 'exact', head: true })
      .or('sugar_g.is.null,saturated_fat_g.is.null,cholesterol_mg.is.null');

    return new Response(JSON.stringify({
      processed: results.length,
      remaining: remaining || 0,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
