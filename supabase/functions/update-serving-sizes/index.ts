import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal',
};

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

    const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

Calculate what ONE SERVING equals in terms of the COMPLETED DISH with SPECIFIC COUNTS.

CRITICAL CALCULATION RULES:
1. For countable protein items (chicken tenders, wings, drumsticks, meatballs, patties, nuggets):
   - Calculate: total quantity ÷ number of servings = pieces per serving
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders total ÷ 4 servings = "3 chicken tenders"
   - Example: "16 meatballs total" ÷ 4 servings = "4 meatballs"
   - If the ingredient says "chicken tenders" or "tenderloins", calculate approximate count (1 lb ≈ 6-8 tenders)

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use weight per serving: "6 oz salmon" or "5 oz steak"

3. For non-countable items (soups, stews, rice dishes, salads):
   - Use volume: "1 cup soup" or "1.5 cups fried rice" or "1 bowl"

4. For multi-component dishes:
   - Combine protein count + sides: "3 chicken tenders + 1 cup vegetables"

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC with actual piece counts or weights.

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.
Examples:
- "3 chicken tenders"
- "4 meatballs + 1.5 cups potatoes + sauce"
- "6 oz salmon + 1 cup rice"
- "1 chicken breast + 1 cup vegetables"
- "12 oz smoothie"
- "1 bowl (2 cups)"`;

          const result = await model.generateContent(prompt);
          let servingSize = result.response.text()?.trim();

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
