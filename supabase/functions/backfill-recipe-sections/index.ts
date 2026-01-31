import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-internal",
};

// ═══════════════════════════════════════════════════════════════
// USER-FRIENDLY QUANTITY FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Smart rounding for quantities:
 * - Uses fractions for common cooking measurements (1/4, 1/3, 1/2, 2/3, 3/4)
 * - Rounds to whole numbers when close
 * - Keeps 1 decimal for odd amounts
 */
function smartRoundQuantity(value: number): number {
  // Round to nearest 0.25 for cleaner fractions
  const nearestQuarter = Math.round(value * 4) / 4;
  
  // If very close to a whole number, use that
  if (Math.abs(value - Math.round(value)) < 0.1) {
    return Math.round(value);
  }
  
  return nearestQuarter;
}

/**
 * Checks if a unit represents a compound measurement like "6 oz fillets"
 * and reformats to user-friendly style: unit becomes "fillets", quantity stays the count
 */
function parseCompoundUnit(unit: string): { baseUnit: string; sizeSpec: string } | null {
  // Pattern: "6 oz fillets", "12 oz can", "100g portions"
  const match = unit.match(/^(\d+\s*(?:oz|g|lb|ml|fl oz|kg))\s+(.+)$/i);
  if (match) {
    return { sizeSpec: match[1], baseUnit: match[2] };
  }
  return null;
}

/**
 * Reformats ingredient for user-friendly display in the database
 * Handles compound units and ensures clean quantities
 */
function reformatIngredient(
  quantity: number | null,
  unit: string | null,
  name: string
): { quantity: number | null; unit: string | null; name: string } {
  // If no quantity, return as-is
  if (quantity === null) {
    return { quantity, unit, name };
  }
  
  // Smart round the quantity
  const roundedQty = smartRoundQuantity(quantity);
  
  // Check for compound units
  if (unit) {
    const compound = parseCompoundUnit(unit);
    if (compound) {
      // Reformat: "4 x 6 oz fillets" becomes quantity=4, unit="fillets (6 oz each)", name stays same
      return {
        quantity: roundedQty,
        unit: `${compound.baseUnit} (${compound.sizeSpec} each)`,
        name,
      };
    }
  }
  
  return {
    quantity: roundedQty,
    unit,
    name,
  };
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
    const { batchSize = 5, recipeId, dryRun = false } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_AI_STUDIO_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    let recipes: any[] = [];

    if (recipeId) {
      // Specific recipe requested
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title")
        .eq("id", recipeId)
        .single();
      
      if (error) throw new Error(`Recipe not found: ${error.message}`);
      recipes = data ? [data] : [];
    } else {
      // Find global recipes that need section backfill
      // A recipe needs backfill if it has NO steps with introduces_section set
      // This is more reliable than checking ingredient sections since Main is always set
      
      // First, get IDs of recipes that already have step sections
      const { data: processedRecipeIds } = await supabase
        .from("recipe_steps")
        .select("recipe_id")
        .not("introduces_section", "is", null);
      
      const processedSet = new Set((processedRecipeIds || []).map((r: any) => r.recipe_id));
      
      // Now fetch global recipes and filter out already-processed ones
      const { data: globalRecipes, error } = await supabase
        .from("recipes")
        .select("id, title")
        .eq("scope", "global")
        .eq("is_deleted", false)
        .order("title", { ascending: true })
        .limit(500); // Fetch more to find unprocessed ones

      if (error) throw new Error(`Failed to fetch recipes: ${error.message}`);

      // Filter to only unprocessed recipes
      const recipesNeedingBackfill = (globalRecipes || [])
        .filter((recipe: any) => !processedSet.has(recipe.id))
        .slice(0, batchSize);

      recipes = recipesNeedingBackfill;
      console.log(`Found ${recipes.length} recipes needing section backfill (${processedSet.size} already processed)`);
    }

    if (recipes.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipes need section backfill" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ id: string; title: string; status: string; sections?: string[]; error?: string }> = [];

    for (const recipe of recipes) {
      try {
        console.log(`Processing: ${recipe.title}`);

        // Fetch current ingredients and steps
        const { data: ingredients } = await supabase
          .from("recipe_ingredients")
          .select("id, name, quantity, unit, order_index")
          .eq("recipe_id", recipe.id)
          .order("order_index");

        const { data: steps } = await supabase
          .from("recipe_steps")
          .select("id, step_number, instruction")
          .eq("recipe_id", recipe.id)
          .order("step_number");

        if (!ingredients?.length || !steps?.length) {
          results.push({ id: recipe.id, title: recipe.title, status: "skipped", error: "No ingredients or steps" });
          continue;
        }

        // Build prompt for AI to analyze and assign sections
        const ingredientsList = ingredients
          .map((ing, i) => `${i + 1}. ${ing.quantity || ""} ${ing.unit || ""} ${ing.name}`.trim())
          .join("\n");

        const stepsList = steps
          .map((step) => `Step ${step.step_number}: ${step.instruction}`)
          .join("\n");

        const prompt = `Analyze this recipe and assign section groupings for ingredients based on WHICH STEP THEY ARE FIRST USED IN.

RECIPE: ${recipe.title}

INGREDIENTS:
${ingredientsList}

STEPS:
${stepsList}

CRITICAL TASK - READ EACH STEP CAREFULLY:
1. For EACH step, identify which ingredients are mentioned or used in that step
2. Group ingredients by the STEP NUMBER where they FIRST appear
3. Ingredients used at different steps MUST be in different sections, even if they're both "main" ingredients

STEP-BASED SECTIONING RULES:
- Read step 2: "Wash the asparagus" → Asparagus is first used here, create section for step 2
- Read step 4: "Wrap bacon around asparagus" → Bacon is first used HERE (step 4), NOT step 2!
- Even if asparagus and bacon are both "main" ingredients, they go in SEPARATE sections because they're used at different steps

SECTION NAMING:
- If an ingredient is used with a specific technique, name it: "Spice Rub", "Marinade", "Sauce", "Coating"
- If it's just a main ingredient at a later step, use the step context: "For Wrapping", "For Serving", "For Assembly"
- Only use "Main" for ingredients that are ALL used together in the same step

INTRODUCES_SECTION RULES:
- Each section MUST be introduced at the step where its ingredients are FIRST mentioned
- Example: If asparagus is first mentioned in step 2 and bacon in step 4:
  - Step 2 introduces "Main" (asparagus only)
  - Step 4 introduces "For Wrapping" (bacon)
- NEVER group ingredients together if they're first used in different steps!

Return JSON:
{
  "ingredients": [
    { "index": 1, "section": "Main" },
    { "index": 2, "section": "For Wrapping" }
  ],
  "steps": [
    { "step_number": 1, "introduces_section": null },
    { "step_number": 2, "introduces_section": "Main" },
    { "step_number": 4, "introduces_section": "For Wrapping" }
  ]
}

IMPORTANT: Only return JSON. Use 1-based indexing.`;

        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: { temperature: 0 },
        });

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        if (!content) {
          throw new Error("No AI response");
        }

        // Parse JSON
        let sectionData;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON in response");
          sectionData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          throw new Error(`Failed to parse AI response: ${parseError}`);
        }

        // Validate structure
        if (!sectionData.ingredients || !sectionData.steps) {
          throw new Error("Invalid response structure");
        }

        // Collect unique sections for logging
        const uniqueSections = [...new Set(sectionData.ingredients.map((i: any) => i.section))] as string[];

        if (dryRun) {
          console.log(`[DRY RUN] Would update ${recipe.title}:`, sectionData);
          results.push({ 
            id: recipe.id, 
            title: recipe.title, 
            status: "dry-run", 
            sections: uniqueSections 
          });
          continue;
        }

        // Update ingredients with sections AND reformat quantities
        let quantitiesFixed = 0;
        for (const ingUpdate of sectionData.ingredients) {
          const ingredient = ingredients[ingUpdate.index - 1];
          if (ingredient) {
            // Reformat ingredient for user-friendly display
            const reformatted = reformatIngredient(
              ingredient.quantity,
              ingredient.unit,
              ingredient.name
            );
            
            // Track if we changed the quantity/unit
            if (reformatted.quantity !== ingredient.quantity || reformatted.unit !== ingredient.unit) {
              quantitiesFixed++;
            }
            
            await supabase
              .from("recipe_ingredients")
              .update({ 
                section: ingUpdate.section || "Main",
                quantity: reformatted.quantity,
                unit: reformatted.unit,
              })
              .eq("id", ingredient.id);
          }
        }
        
        console.log(`  - Fixed ${quantitiesFixed} ingredient quantities`);

        // Update steps with introduces_section
        for (const stepUpdate of sectionData.steps) {
          const step = steps.find((s) => s.step_number === stepUpdate.step_number);
          if (step) {
            await supabase
              .from("recipe_steps")
              .update({ introduces_section: stepUpdate.introduces_section })
              .eq("id", step.id);
          }
        }

        results.push({ 
          id: recipe.id, 
          title: recipe.title, 
          status: "success", 
          sections: uniqueSections 
        });
        console.log(`✅ Updated: ${recipe.title} with sections: ${uniqueSections.join(", ")}`);

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

    const successCount = results.filter((r) => r.status === "success").length;

    return new Response(
      JSON.stringify({
        message: `Backfilled ${successCount} of ${recipes.length} recipes`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
