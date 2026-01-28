import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-internal",
};

// Calculate serving_size using AI Chef rules
async function calculateServingSize(
  title: string,
  servings: number,
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null }>,
  model: any
): Promise<string> {
  const ingredientsList = ingredients
    .map(ing => `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim())
    .join(', ');

  const prompt = `Given this recipe with ${servings} servings:
Title: ${title}
Ingredients: ${ingredientsList}

Calculate what ONE SERVING equals in terms of the COMPLETED DISH with SPECIFIC COUNTS.

CRITICAL CALCULATION RULES:
1. For countable protein items (chicken tenders, wings, drumsticks, meatballs, patties, nuggets):
   - Calculate: total quantity ÷ number of servings = pieces per serving
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders total ÷ 5 servings = "2-3 chicken tenders"

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use weight per serving: "6 oz salmon" or "5 oz steak"

3. For non-countable items (soups, stews, rice dishes, salads, bowls):
   - Use volume: "1 cup soup" or "1.5 cups fried rice" or "1 bowl (about 2 cups)"

4. For multi-component dishes:
   - Combine protein count + sides: "3 chicken tenders + 1 cup vegetables"

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC.

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.`;

  try {
    const result = await model.generateContent(prompt);
    let servingSize = result.response.text()?.trim();
    if (servingSize) {
      return servingSize
        .replace(/^["']|["']$/g, '')
        .replace(/^\*+|\*+$/g, '')
        .substring(0, 100);
    }
  } catch (err) {
    console.error('Error calculating serving size:', err);
  }
  return '1 serving';
}

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
    const { 
      fromServings = 4, 
      toServings = 5, 
      limit = 50,
      dryRun = false 
    } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_AI_STUDIO_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Calculate the scaling factor
    const scaleFactor = toServings / fromServings;
    console.log(`Scaling recipes from ${fromServings} to ${toServings} servings (factor: ${scaleFactor})`);

    // Get all global recipes with the specified serving count
    const { data: recipes, error: fetchError } = await supabase
      .from("recipes")
      .select(`
        id,
        title,
        servings,
        recipe_ingredients (
          id,
          name,
          quantity,
          unit
        )
      `)
      .eq("scope", "global")
      .eq("servings", fromServings)
      .eq("is_deleted", false)
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ 
        message: `No recipes found with ${fromServings} servings`,
        updated: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${recipes.length} recipes to scale`);

    const results: Array<{ 
      title: string; 
      status: string; 
      oldServings: number;
      newServings: number;
      newServingSize?: string;
      ingredientsScaled?: number;
      error?: string 
    }> = [];

    // Process each recipe
    for (const recipe of recipes) {
      try {
        console.log(`Processing: ${recipe.title}`);
        
        const ingredients = recipe.recipe_ingredients || [];
        
        if (dryRun) {
          // Just report what would happen
          const scaledIngredients = ingredients.map((ing: any) => ({
            name: ing.name,
            oldQty: ing.quantity,
            newQty: ing.quantity ? Math.round(ing.quantity * scaleFactor * 100) / 100 : null,
            unit: ing.unit
          }));
          
          results.push({
            title: recipe.title,
            status: "dry-run",
            oldServings: fromServings,
            newServings: toServings,
            ingredientsScaled: ingredients.length
          });
          continue;
        }

        // Scale each ingredient quantity
        for (const ing of ingredients) {
          if (ing.quantity !== null && ing.quantity !== undefined) {
            const newQuantity = Math.round(ing.quantity * scaleFactor * 100) / 100;
            
            const { error: updateIngError } = await supabase
              .from("recipe_ingredients")
              .update({ quantity: newQuantity })
              .eq("id", ing.id);

            if (updateIngError) {
              console.error(`Failed to update ingredient ${ing.name}:`, updateIngError);
            }
          }
        }

        // Calculate new serving_size with scaled ingredients
        const scaledIngredients = ingredients.map((ing: any) => ({
          name: ing.name,
          quantity: ing.quantity ? Math.round(ing.quantity * scaleFactor * 100) / 100 : null,
          unit: ing.unit
        }));

        const newServingSize = await calculateServingSize(
          recipe.title,
          toServings,
          scaledIngredients,
          model
        );

        // Update the recipe servings and serving_size
        const { error: updateRecipeError } = await supabase
          .from("recipes")
          .update({ 
            servings: toServings,
            serving_size: newServingSize
          })
          .eq("id", recipe.id);

        if (updateRecipeError) {
          throw updateRecipeError;
        }

        results.push({
          title: recipe.title,
          status: "success",
          oldServings: fromServings,
          newServings: toServings,
          newServingSize,
          ingredientsScaled: ingredients.length
        });

        console.log(`✅ Scaled: ${recipe.title} -> ${toServings} servings, "${newServingSize}"`);

        // Small delay to avoid rate limits
        // Longer delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ Failed ${recipe.title}:`, error);
        results.push({
          title: recipe.title,
          status: "error",
          oldServings: fromServings,
          newServings: toServings,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;

    return new Response(
      JSON.stringify({
        message: dryRun 
          ? `Dry run: would scale ${recipes.length} recipes from ${fromServings} to ${toServings} servings`
          : `Scaled ${successCount} of ${recipes.length} recipes from ${fromServings} to ${toServings} servings`,
        scaleFactor,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scale error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
