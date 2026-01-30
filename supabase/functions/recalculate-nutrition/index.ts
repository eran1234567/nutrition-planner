import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal-seed',
};

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

    const { batchSize = 10, offset = 0 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY')!;

    if (!geminiApiKey) {
      throw new Error('GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Get global recipes with their ingredients
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select(`
        id,
        title,
        servings,
        recipe_ingredients(name, quantity, unit)
      `)
      .eq('scope', 'global')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch recipes: ${fetchError.message}`);
    }

    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more recipes to process',
        processed: 0,
        offset,
        done: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${recipes.length} recipes starting at offset ${offset}`);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0 }, // Deterministic output
    });

    const results: Array<{ id: string; title: string; status: string; nutrition?: any; error?: string }> = [];

    for (const recipe of recipes) {
      try {
        const ingredients = (recipe.recipe_ingredients || []) as Array<{ name: string; quantity?: number; unit?: string }>;
        
        if (ingredients.length === 0) {
          results.push({ id: recipe.id, title: recipe.title, status: 'skipped', error: 'No ingredients' });
          continue;
        }

        const ingredientList = ingredients
          .map((i) => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim())
          .join('\n- ');

        console.log(`Recalculating: ${recipe.title}`);

        const prompt = `You are a certified nutritionist. Calculate ACCURATE macros for this recipe PER SERVING.

RECIPE: ${recipe.title}
SERVINGS: ${recipe.servings || 1}

INGREDIENTS:
- ${ingredientList}

═══════════════════════════════════════════════════════════════
USDA STANDARD MACRO REFERENCES (use these EXACT values!):
═══════════════════════════════════════════════════════════════
- 1 large egg = 72 cal, 6.3g protein, 0.4g carbs, 4.8g fat, 0g fiber
- 1 medium tomato = 22 cal, 1.1g protein, 4.8g carbs, 0.2g fat, 1.5g fiber
- 1 slice regular bread = 79 cal, 2.7g protein, 15g carbs, 1g fat, 1g fiber
- 1 tbsp olive oil = 119 cal, 0g protein, 0g carbs, 13.5g fat, 0g fiber
- 1 tbsp butter = 102 cal, 0.1g protein, 0g carbs, 11.5g fat, 0g fiber
- 1 medium avocado (201g) = 322 cal, 4g protein, 17g carbs, 29g fat, 13g fiber
- Half avocado (100g) = 160 cal, 2g protein, 8.5g carbs, 14.7g fat, 7g fiber
- 100g chicken breast = 165 cal, 31g protein, 0g carbs, 3.6g fat, 0g fiber
- 100g salmon = 208 cal, 20g protein, 0g carbs, 13g fat, 0g fiber
- 100g ground beef 90/10 = 176 cal, 26g protein, 0g carbs, 8g fat, 0g fiber
- 1 cup cooked rice = 205 cal, 4.3g protein, 45g carbs, 0.4g fat, 0.6g fiber
- 1 cup cooked pasta = 220 cal, 8g protein, 43g carbs, 1.3g fat, 2.5g fiber

═══════════════════════════════════════════════════════════════
FIBER AND NET CARBS - CRITICAL FOR CALORIE ACCURACY
═══════════════════════════════════════════════════════════════
FIBER DOES NOT CONTRIBUTE CALORIES! This is critical for keto/high-fiber foods.

When calculating calories from carbs:
- NET CARBS = Total Carbs - Fiber
- CALORIES from carbs = NET CARBS × 4 (NOT total carbs × 4!)

EXAMPLE - High fiber food:
If an ingredient has 13g carbs and 12g fiber:
- Net carbs = 13 - 12 = 1g
- Calories from carbs = 1 × 4 = 4 cal (NOT 13 × 4 = 52 cal!)

CALCULATION METHOD:
1. For EACH ingredient, calculate: protein, total carbs, fiber, fat
2. SUM all ingredient values to get TOTAL recipe values
3. Calculate total calories: (protein × 4) + ((total_carbs - fiber) × 4) + (fat × 9)
4. DIVIDE all totals by servings to get per-serving values
5. Round to nearest integer

Return ONLY valid JSON (no markdown, no backticks):
{
  "calories": <integer>,
  "protein_g": <integer>,
  "carbs_g": <integer>,
  "fat_g": <integer>,
  "fiber_g": <integer>,
  "sugar_g": <integer>,
  "sodium_mg": <integer>,
  "saturated_fat_g": <integer>,
  "cholesterol_mg": <integer>
}`;

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        if (!content) {
          throw new Error('No AI response');
        }

        // Parse JSON
        let nutrition;
        try {
          const cleanedJson = content.replace(/```json\s*|\s*```/g, '').trim();
          const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found');
          }
          nutrition = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          throw new Error(`Failed to parse: ${parseError}`);
        }

        // Update nutrition in database
        const { error: updateError } = await supabase
          .from('recipe_nutrition')
          .update({
            calories: nutrition.calories,
            protein_g: nutrition.protein_g,
            carbs_g: nutrition.carbs_g,
            fat_g: nutrition.fat_g,
            fiber_g: nutrition.fiber_g,
            sugar_g: nutrition.sugar_g || 0,
            sodium_mg: nutrition.sodium_mg || 0,
            saturated_fat_g: nutrition.saturated_fat_g || 0,
            cholesterol_mg: nutrition.cholesterol_mg || 0,
          })
          .eq('recipe_id', recipe.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }

        results.push({ 
          id: recipe.id, 
          title: recipe.title, 
          status: 'success',
          nutrition 
        });
        console.log(`✅ Updated: ${recipe.title} - ${nutrition.calories} cal, ${nutrition.protein_g}g protein`);

      } catch (error) {
        console.error(`❌ Failed ${recipe.title}:`, error);
        results.push({
          id: recipe.id,
          title: recipe.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    return new Response(
      JSON.stringify({
        message: `Processed ${recipes.length} recipes: ${successCount} updated, ${errorCount} errors, ${skippedCount} skipped`,
        processed: recipes.length,
        offset,
        nextOffset: offset + batchSize,
        done: recipes.length < batchSize,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recalculate nutrition error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
