import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// Import shared Neutron Engine
import {
  buildNutritionPromptInstructions,
  calculateIngredientMacros,
  validateAndCorrectNutrition,
  type DbIngredientNutrition,
} from "../_shared/neutron.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-internal-seed, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // If internal seed header is present, keep legacy batch behavior (global recipes).
    const internalHeader = req.headers.get('X-Lovable-Internal-Seed');
    if (internalHeader !== 'true') {
      // User-triggered single-recipe recalculation
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { recipeId } = await req.json().catch(() => ({}));
      if (!recipeId) {
        return new Response(JSON.stringify({ error: 'Missing recipeId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify user
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      const user = userData?.user;
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use service role for deterministic recalculation + write, but enforce ownership manually.
      const admin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      const { data: recipe, error: recipeError } = await admin
        .from('recipes')
        .select('id, title, owner_user_id, servings, is_deleted')
        .eq('id', recipeId)
        .maybeSingle();

      if (recipeError || !recipe || recipe.is_deleted) {
        return new Response(JSON.stringify({ error: 'Recipe not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (recipe.owner_user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [ingredientsRes, existingNutritionRes] = await Promise.all([
        admin
          .from('recipe_ingredients')
          .select('name, quantity, unit')
          .eq('recipe_id', recipeId),
        admin
          .from('recipe_nutrition')
          .select('*')
          .eq('recipe_id', recipeId)
          .maybeSingle(),
      ]);

      const ingredients = (ingredientsRes.data || []) as Array<{ name: string; quantity: number | null; unit: string | null }>;
      if (ingredientsRes.error || ingredients.length === 0) {
        return new Response(JSON.stringify({ error: 'No ingredients found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Load ingredient nutrition cache
      const nutritionCache = await loadIngredientNutritionCache(admin);

      // IMPORTANT: feed quantity+unit into the Neutron matcher/quantity parser
      const ingredientTexts = ingredients.map((i) => ({
        name: `${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`.trim(),
      }));

      const baseNutrition = (existingNutritionRes.data || {}) as any;
      const servings = recipe.servings || 1;

      // Fast-path: if most ingredients are covered by deterministic references, compute without AI.
      let knownCount = 0;
      const deterministicTotal: any = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        saturated_fat: 0,
        cholesterol: 0,
      };

      for (const ing of ingredientTexts) {
        const macros = calculateIngredientMacros(ing.name, nutritionCache);
        if (macros) {
          deterministicTotal.calories += macros.calories;
          deterministicTotal.protein += macros.protein;
          deterministicTotal.carbs += macros.carbs;
          deterministicTotal.fat += macros.fat;
          deterministicTotal.fiber += macros.fiber;
          deterministicTotal.sugar += macros.sugar ?? 0;
          deterministicTotal.sodium += macros.sodium ?? 0;
          deterministicTotal.saturated_fat += macros.saturated_fat ?? 0;
          deterministicTotal.cholesterol += macros.cholesterol ?? 0;
          knownCount++;
        }
      }

      const coverage = ingredientTexts.length > 0 ? knownCount / ingredientTexts.length : 0;

      let corrected: any;
      if (coverage >= 0.7) {
        corrected = {
          calories: Math.round(deterministicTotal.calories / servings),
          protein_g: Math.round(deterministicTotal.protein / servings),
          carbs_g: Math.round(deterministicTotal.carbs / servings),
          fat_g: Math.round(deterministicTotal.fat / servings),
          fiber_g: Math.round(deterministicTotal.fiber / servings),
          sugar_g: Math.round(deterministicTotal.sugar / servings),
          sodium_mg: Math.round(deterministicTotal.sodium / servings),
          saturated_fat_g: Math.round(deterministicTotal.saturated_fat / servings),
          cholesterol_mg: Math.round(deterministicTotal.cholesterol / servings),
        };
      } else {
        // Fallback: use AI to estimate the missing macros reliably.
        const geminiApiKey = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY')!;
        if (!geminiApiKey) {
          // As a last resort, return the existing values.
          corrected = baseNutrition;
        } else {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { temperature: 0 },
          });

          const ingredientList = ingredients
            .map((i) => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim())
            .join('\n- ');

          const prompt = `You are a certified nutritionist. Calculate ACCURATE macros for this recipe PER SERVING.

RECIPE: ${recipe.title ?? 'Recipe'}
SERVINGS: ${servings}

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
          if (!content) throw new Error('No AI response');

          let aiNutrition: any;
          const cleanedJson = content.replace(/```json\s*|\s*```/g, '').trim();
          const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found');
          aiNutrition = JSON.parse(jsonMatch[0]);

          // Keep deterministic correction behavior consistent with the rest of the system.
          corrected = validateAndCorrectNutrition(aiNutrition, ingredientTexts, nutritionCache, servings);
        }
      }

      // Persist to recipe_nutrition (insert if missing)
      if (existingNutritionRes.data) {
        const { error: updateError } = await admin
          .from('recipe_nutrition')
          .update({
            calories: corrected.calories ?? null,
            protein_g: corrected.protein_g ?? null,
            carbs_g: corrected.carbs_g ?? null,
            fat_g: corrected.fat_g ?? null,
            fiber_g: corrected.fiber_g ?? null,
            sugar_g: corrected.sugar_g ?? 0,
            sodium_mg: corrected.sodium_mg ?? 0,
            saturated_fat_g: corrected.saturated_fat_g ?? 0,
            cholesterol_mg: corrected.cholesterol_mg ?? 0,
          })
          .eq('recipe_id', recipeId);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await admin
          .from('recipe_nutrition')
          .insert({
            recipe_id: recipeId,
            calories: corrected.calories ?? null,
            protein_g: corrected.protein_g ?? null,
            carbs_g: corrected.carbs_g ?? null,
            fat_g: corrected.fat_g ?? null,
            fiber_g: corrected.fiber_g ?? null,
            sugar_g: corrected.sugar_g ?? 0,
            sodium_mg: corrected.sodium_mg ?? 0,
            saturated_fat_g: corrected.saturated_fat_g ?? 0,
            cholesterol_mg: corrected.cholesterol_mg ?? 0,
          });

        if (insertError) {
          throw new Error(`DB insert failed: ${insertError.message}`);
        }
      }

      return new Response(
        JSON.stringify({ nutrition: corrected }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy batch mode for global recipes (admin/internal)
    const { batchSize = 10, offset = 0 } = await req.json().catch(() => ({}));

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
