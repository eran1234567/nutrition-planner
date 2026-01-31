import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

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
      // These are recipes where ALL ingredients have NULL section
      const { data: globalRecipes, error } = await supabase
        .from("recipes")
        .select("id, title")
        .eq("scope", "global")
        .eq("is_deleted", false)
        .limit(batchSize * 3); // Fetch more to filter

      if (error) throw new Error(`Failed to fetch recipes: ${error.message}`);

      // Check which recipes have no section data
      const recipesNeedingBackfill: any[] = [];
      
      for (const recipe of globalRecipes || []) {
        const { data: ingredients } = await supabase
          .from("recipe_ingredients")
          .select("section")
          .eq("recipe_id", recipe.id);
        
        // Check if ANY ingredient has a non-null, non-Main section
        // This means the recipe was already processed properly
        const hasRealSections = ingredients?.some(
          (ing) => ing.section && ing.section !== "Main"
        );
        
        // Also check if steps have introduces_section
        const { data: steps } = await supabase
          .from("recipe_steps")
          .select("introduces_section")
          .eq("recipe_id", recipe.id);
        
        const hasStepSections = steps?.some(
          (step) => step.introduces_section !== null
        );
        
        // Skip if already has proper section data
        if (!hasRealSections && !hasStepSections) {
          recipesNeedingBackfill.push(recipe);
          if (recipesNeedingBackfill.length >= batchSize) break;
        }
      }

      recipes = recipesNeedingBackfill;
      console.log(`Found ${recipes.length} recipes needing section backfill`);
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

        const prompt = `Analyze this recipe and assign section groupings for ingredients and steps.

RECIPE: ${recipe.title}

INGREDIENTS:
${ingredientsList}

STEPS:
${stepsList}

TASK:
1. Group ingredients into logical sections based on how they're used in the recipe
2. Determine which step FIRST uses each section's ingredients

SECTION NAMING RULES:
- Use "Main" for primary dish ingredients (proteins, main vegetables, base starches)
- Use specific names for sub-components: "Marinade", "Sauce", "Dressing", "Glaze", "Spice Rub", "Topping", "Garnish"
- Look at the steps to understand ingredient groupings
- If step 1 says "mix marinade ingredients" and lists specific items, those are "Marinade"
- If a sauce is made separately, group those as "Sauce"

INTRODUCES_SECTION RULES (CRITICAL):
- Set "introduces_section" on the FIRST step where that section's ingredients are actually used
- DO NOT default "Main" to step 1 automatically
- Example: If step 1 is "Make the marinade by mixing...", that step introduces "Marinade"
- Example: If step 2 is "Add the chicken to the marinade", that step introduces "Main"
- Example: If step 5 is "Meanwhile, prepare the sauce...", that step introduces "Sauce"

Return JSON with this exact structure:
{
  "ingredients": [
    { "index": 1, "section": "Marinade" },
    { "index": 2, "section": "Marinade" },
    { "index": 3, "section": "Main" }
  ],
  "steps": [
    { "step_number": 1, "introduces_section": "Marinade" },
    { "step_number": 2, "introduces_section": "Main" },
    { "step_number": 3, "introduces_section": null }
  ]
}

IMPORTANT: Only return the JSON, no explanation. Use 1-based indexing matching the ingredient/step numbers above.`;

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

        // Update ingredients with sections
        for (const ingUpdate of sectionData.ingredients) {
          const ingredient = ingredients[ingUpdate.index - 1];
          if (ingredient) {
            await supabase
              .from("recipe_ingredients")
              .update({ section: ingUpdate.section || "Main" })
              .eq("id", ingredient.id);
          }
        }

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
