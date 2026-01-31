import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// Import shared Neutron Engine
import {
  buildNutritionPromptInstructions,
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
} from "../_shared/neutron.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-internal",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only check
  const internalHeader = req.headers.get("X-Lovable-Internal");
  if (internalHeader !== "true") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { batchSize = 5, recipeId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_AI_STUDIO_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    let recipes: any[] = [];
    let recipesError: any = null;

    if (recipeId) {
      // Specific recipe requested
      const result = await supabase
        .from("recipes")
        .select("id, title, cuisine, description, servings")
        .eq("id", recipeId)
        .single();
      recipes = result.data ? [result.data] : [];
      recipesError = result.error;
    } else {
      // Get global recipes with their ingredient counts using a subquery approach
      const { data: allGlobalRecipes, error: recipeError } = await supabase
        .from("recipes")
        .select("id, title, cuisine, description, servings")
        .eq("scope", "global")
        .eq("is_deleted", false);

      if (recipeError) {
        throw new Error(`Failed to fetch recipes: ${recipeError.message}`);
      }

      // Get ALL ingredient records (may be > 1000, need to paginate)
      let allIngredientRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: batch, error: countError } = await supabase
          .from("recipe_ingredients")
          .select("recipe_id")
          .range(from, from + pageSize - 1);

        if (countError) {
          throw new Error(`Failed to count ingredients: ${countError.message}`);
        }
        
        allIngredientRows = allIngredientRows.concat(batch || []);
        
        if (!batch || batch.length < pageSize) break;
        from += pageSize;
      }
      
      const ingredientCounts = allIngredientRows;

      // Count ingredients per recipe
      const counts: Record<string, number> = {};
      for (const row of ingredientCounts || []) {
        counts[row.recipe_id] = (counts[row.recipe_id] || 0) + 1;
      }

      // Filter to recipes with < 5 ingredients
      const unprocessedRecipes = (allGlobalRecipes || [])
        .filter((r: any) => (counts[r.id] || 0) < 5)
        .slice(0, batchSize);
      
      recipes = unprocessedRecipes;
      console.log(`Found ${recipes.length} unprocessed recipes (< 5 ingredients)`);
    }

    if (recipesError) {
      throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
    }

    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ message: "No recipes to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];

    for (const recipe of recipes) {
      try {
        console.log(`Regenerating: ${recipe.title}`);

        // Use the same detailed AI prompt as parse-recipe with Neutron Engine
        const systemPrompt = `You are a professional chef and nutritionist creating complete, authentic recipes.

CRITICAL REQUIREMENTS:
1. Generate COMPLETE ingredient lists - include ALL ingredients needed (oil for cooking, salt, garlic, ginger, spices, etc.)
2. Generate DETAILED step-by-step instructions - each step should be specific and actionable
3. Ingredients should have accurate quantities and units
4. Steps should reference the ingredients and include timing/technique details
5. Make the recipe authentic to its cuisine

${buildNutritionPromptInstructions()}

USDA STANDARD MACRO REFERENCES:
- 1 large egg = 72 cal, 6.3g protein, 0.4g carbs, 4.8g fat, 0g fiber, 186mg cholesterol
- Half avocado (100g) = 160 cal, 2g protein, 8.5g carbs, 14.7g fat, 7g fiber
- 100g chicken breast = 165 cal, 31g protein, 0g carbs, 3.6g fat, 0g fiber, 85mg cholesterol`;

        const userPrompt = `Generate a complete, authentic recipe for: "${recipe.title}"
Cuisine: ${recipe.cuisine || "International"}
Description: ${recipe.description || ""}
Servings: ${recipe.servings || 4}

Return a JSON object with this exact structure:
{
  "ingredients": [
    { "name": "ingredient name", "quantity": 2, "unit": "cups", "aisle": "Produce|Meat|Dairy|Bakery|Canned Goods|Spices|Oils|Frozen|Beverages|Condiments|Grains|Pasta" }
  ],
  "steps": [
    "Detailed step 1 with specific instructions...",
    "Detailed step 2..."
  ],
  "nutrition": {
    "calories": 350,
    "protein_g": 25,
    "carbs_g": 40,
    "fat_g": 12,
    "fiber_g": 8,
    "sodium_mg": 450,
    "sugar_g": 5,
    "saturated_fat_g": 3,
    "cholesterol_mg": 45
  },
  "serving_size": "3 chicken tenders"
}

SERVING_SIZE RULES (CRITICAL):
✅ GOOD: "3 chicken tenders", "1 salmon fillet (6 oz)", "2 tacos", "1.5 cups rice", "4 meatballs + 1 cup pasta"
❌ BAD: "0.38 lb chicken + 0.5 cups vegetables", "1 serving", "1/4 of recipe"
- Use whole numbers for countable items
- Round weights to whole ounces
- Max 50 characters, no "1 serving =" prefix

IMPORTANT:
- Include 8-15 ingredients for a complete recipe
- Include 5-10 detailed steps
- All nutrition values are PER SERVING
- Be authentic to the cuisine
- Remember: Calories from carbs = (carbs_g - fiber_g) × 4`;

        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          generationConfig: { temperature: 0 }, // Deterministic output for consistent macros
        });
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const content = result.response.text();

        if (!content) {
          throw new Error("No content in AI response");
        }

        // Parse JSON from response
        let recipeData;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in response");
          }
          recipeData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          throw new Error(`Failed to parse AI response: ${parseError}`);
        }

        // Validate required fields
        if (!recipeData.ingredients || !Array.isArray(recipeData.ingredients) || recipeData.ingredients.length < 3) {
          throw new Error("Invalid or insufficient ingredients");
        }
        if (!recipeData.steps || !Array.isArray(recipeData.steps) || recipeData.steps.length < 3) {
          throw new Error("Invalid or insufficient steps");
        }

        // Delete existing ingredients and steps
        await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
        await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);

        // Insert new ingredients
        const ingredientsToInsert = recipeData.ingredients.map((ing: any, index: number) => ({
          recipe_id: recipe.id,
          name: ing.name,
          quantity: ing.quantity || null,
          unit: ing.unit || null,
          aisle: ing.aisle || "Other",
          order_index: index,
        }));

        const { error: ingredientsError } = await supabase
          .from("recipe_ingredients")
          .insert(ingredientsToInsert);

        if (ingredientsError) {
          throw new Error(`Failed to insert ingredients: ${ingredientsError.message}`);
        }

        // Insert new steps
        const stepsToInsert = recipeData.steps.map((step: string, index: number) => ({
          recipe_id: recipe.id,
          step_number: index + 1,
          instruction: step,
        }));

        const { error: stepsError } = await supabase
          .from("recipe_steps")
          .insert(stepsToInsert);

        if (stepsError) {
          throw new Error(`Failed to insert steps: ${stepsError.message}`);
        }

        // Update nutrition
        if (recipeData.nutrition) {
          const { error: nutritionError } = await supabase
            .from("recipe_nutrition")
            .update({
              calories: recipeData.nutrition.calories,
              protein_g: recipeData.nutrition.protein_g,
              carbs_g: recipeData.nutrition.carbs_g,
              fat_g: recipeData.nutrition.fat_g,
              fiber_g: recipeData.nutrition.fiber_g,
              sodium_mg: recipeData.nutrition.sodium_mg,
              sugar_g: recipeData.nutrition.sugar_g,
              saturated_fat_g: recipeData.nutrition.saturated_fat_g,
              cholesterol_mg: recipeData.nutrition.cholesterol_mg,
            })
            .eq("recipe_id", recipe.id);

          if (nutritionError) {
            console.warn(`Nutrition update warning: ${nutritionError.message}`);
          }
        }

        // Update serving_size on recipe if provided
        if (recipeData.serving_size) {
          await supabase
            .from("recipes")
            .update({ serving_size: recipeData.serving_size })
            .eq("id", recipe.id);
        }

        results.push({ id: recipe.id, title: recipe.title, status: "success" });
        console.log(`✅ Regenerated: ${recipe.title} with ${recipeData.ingredients.length} ingredients and ${recipeData.steps.length} steps`);

      } catch (error) {
        console.error(`❌ Failed ${recipe.title}:`, error);
        results.push({
          id: recipe.id,
          title: recipe.title,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

    return new Response(
      JSON.stringify({
        message: `Regenerated ${successCount} recipes, ${errorCount} errors`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Regenerate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
