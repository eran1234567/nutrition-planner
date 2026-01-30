import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// Import shared Neutron Engine
import {
  buildNutritionPromptInstructions,
  validateAndCorrectNutrition,
  type DbIngredientNutrition,
} from "../_shared/neutron.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal-seed',
};

// Cache for ingredient_nutrition table
let ingredientNutritionCache: DbIngredientNutrition[] = [];

async function loadIngredientNutritionCache(supabase: any): Promise<DbIngredientNutrition[]> {
  if (ingredientNutritionCache.length > 0) return ingredientNutritionCache;
  
  const { data, error } = await supabase.from('ingredient_nutrition').select('*');
  if (error) {
    console.error('[NEUTRON] Failed to load ingredient cache:', error);
    return [];
  }
  ingredientNutritionCache = data || [];
  console.log(`[NEUTRON] Loaded ${ingredientNutritionCache.length} ingredient references`);
  return ingredientNutritionCache;
}

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

    // Load ingredient nutrition cache from Neutron
    const nutritionCache = await loadIngredientNutritionCache(supabase);

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

        // Use Neutron Engine prompt instructions
        const prompt = `You are a certified nutritionist. Calculate ACCURATE macros for this recipe PER SERVING.

RECIPE: ${recipe.title}
SERVINGS: ${recipe.servings || 1}

INGREDIENTS:
- ${ingredientList}

${buildNutritionPromptInstructions()}

CALCULATION METHOD:
1. For EACH ingredient, extract: protein, total carbs, fiber, fat, and calories (if provided)
2. SUM all ingredient values to get TOTAL recipe values
3. If no calories provided, calculate: (protein × 4) + ((total_carbs - fiber) × 4) + (fat × 9)
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
