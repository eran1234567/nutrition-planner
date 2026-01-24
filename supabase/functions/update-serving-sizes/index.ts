import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow internal calls (from Lovable agent)
    const internalHeader = req.headers.get('X-Lovable-Internal');
    if (internalHeader !== 'true') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - internal use only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { limit = 20 } = await req.json().catch(() => ({}));

    // Get recipes without serving_size
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select(`
        id,
        title,
        servings,
        recipe_ingredients (
          name,
          quantity,
          unit
        )
      `)
      .or('serving_size.is.null,serving_size.eq.')
      .eq('is_deleted', false)
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!recipes || recipes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No recipes need updating', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${recipes.length} recipes for serving_size calculation`);

    const results: { id: string; title: string; serving_size: string | null; error?: string }[] = [];

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (recipe: any) => {
        try {
          const ingredients = recipe.recipe_ingredients || [];
          const ingredientsList = ingredients
            .map((ing: any) => `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim())
            .join(', ');

          const prompt = `Given this recipe with ${recipe.servings || 4} servings:
Title: ${recipe.title}
Ingredients: ${ingredientsList}

Calculate what ONE SERVING contains. Be specific about quantities.

For discrete items (meatballs, stuffed peppers, patties, etc.): state how many per serving.
For soups/stews: state approximate cup measurement.
For main dishes: describe the protein portion and sides.

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.
Examples:
- "4 meatballs + 1.5 cups potatoes + sauce"
- "1 stuffed pepper + 0.5 cup rice"
- "6 oz chicken + 1 cup vegetables"
- "2 cups soup with 4 oz chicken"
- "1 chicken breast + 1 cup rice"`;

          const aiResponse = await fetch(LOVABLE_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are a nutrition assistant. Respond with ONLY the serving size description, nothing else.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2,
            }),
          });

          if (!aiResponse.ok) {
            throw new Error(`AI API error: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          let servingSize = aiData.choices?.[0]?.message?.content?.trim();

          if (servingSize) {
            // Clean up the response
            servingSize = servingSize
              .replace(/^["']|["']$/g, '') // Remove quotes
              .replace(/^\*+|\*+$/g, '') // Remove asterisks
              .substring(0, 100); // Limit length

            // Update the recipe
            const { error: updateError } = await supabase
              .from('recipes')
              .update({ serving_size: servingSize })
              .eq('id', recipe.id);

            if (updateError) {
              throw updateError;
            }

            results.push({ id: recipe.id, title: recipe.title, serving_size: servingSize });
            console.log(`Updated: ${recipe.title} -> "${servingSize}"`);
          } else {
            results.push({ id: recipe.id, title: recipe.title, serving_size: null, error: 'No AI response' });
          }
        } catch (err) {
          console.error(`Error processing ${recipe.title}:`, err);
          results.push({ 
            id: recipe.id, 
            title: recipe.title, 
            serving_size: null, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }));

      // Small delay between batches
      if (i + batchSize < recipes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.serving_size && !r.error).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: successCount, 
        total: recipes.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-serving-sizes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
