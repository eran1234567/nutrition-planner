import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// Import shared Neutron Engine - single source of truth
import {
  buildNutritionPromptInstructions,
  KETO_BADGE_MAX_NET_CARBS,
  KETO_BADGE_MIN_FAT_PERCENT,
} from "../_shared/neutron.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-internal",
};

// Generate slug from title for file naming
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Generate AI image and upload to Supabase Storage
async function generateRecipeImage(
  title: string,
  description: string,
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
  genAI: GoogleGenerativeAI,
  supabase: any
): Promise<string | null> {
  const mainIngredients = ingredients
    .slice(0, 5)
    .map(ing => ing.name)
    .join(', ');

  const imagePrompt = `Professional food photography of ${title}. 
A home-cooked dish made with: ${mainIngredients}.
${description || ''}
Final plated dish only. Realistic home-cooked appearance. 
The protein/main ingredients must accurately match the recipe - show ${mainIngredients}.
No text, no extra garnish or props not in the recipe. Natural lighting, overhead or 45-degree angle, clean simple background, appetizing presentation.
16:9 aspect ratio, high-quality food photography style.`;

  try {
    console.log(`Generating image for: ${title}`);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
      generationConfig: {
        responseModalities: ['image', 'text'],
      } as any,
    });

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if ((part as any).inlineData) {
        const imageData = (part as any).inlineData;
        const base64Data = imageData.data;
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `${titleToSlug(title)}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from("recipe-images")
          .upload(`global/${fileName}`, binaryData, {
            contentType: "image/jpeg",
            upsert: true,
          });
        
        if (uploadError) {
          console.error(`Upload error for ${title}:`, uploadError);
          return null;
        }
        
        const { data: urlData } = supabase.storage
          .from("recipe-images")
          .getPublicUrl(`global/${fileName}`);
        
        console.log(`Image uploaded for: ${title}`);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error(`Error generating image for ${title}:`, err);
  }
  return null;
}

// Calculate serving_size using AI Chef rules with Neutron Engine context
async function calculateServingSize(
  title: string,
  servings: number,
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  genAI: GoogleGenerativeAI
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
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders total ÷ 4 servings = "3 chicken tenders"

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use weight per serving: "6 oz salmon" or "5 oz steak"

3. For non-countable items (soups, stews, rice dishes, salads):
   - Use volume: "1 cup soup" or "1.5 cups fried rice" or "1 bowl"

4. For multi-component dishes:
   - Combine protein count + sides: "3 chicken tenders + 1 cup vegetables"

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC.

${buildNutritionPromptInstructions()}

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0 }, // Deterministic output for consistent serving sizes
    });
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

// Comprehensive recipe database organized by cuisine
const recipesByCuisine: Record<string, Array<{
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  difficulty: string;
  is_kid_friendly: boolean;
  is_meal_prep_friendly: boolean;
  is_budget_friendly: boolean;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g?: number;
  saturated_fat_g?: number;
  cholesterol_mg?: number;
  ingredients: Array<{ name: string; quantity: number; unit: string; aisle: string }>;
  steps: string[];
  tags: Array<{ tag_type: string; tag_value: string }>;
  image_prompt: string;
}>> = {
  American: [
    {
      title: "Classic Grilled Cheese",
      description: "Buttery, crispy grilled cheese sandwich with melted cheddar",
      prep_time: 5, cook_time: 10, total_time: 15, servings: 1, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 450, protein_g: 18, carbs_g: 32, fat_g: 28, fiber_g: 2, sodium_mg: 780,
      ingredients: [
        { name: "Bread slices", quantity: 2, unit: "slices", aisle: "Bakery" },
        { name: "Cheddar cheese", quantity: 2, unit: "slices", aisle: "Dairy" },
        { name: "Butter", quantity: 2, unit: "tbsp", aisle: "Dairy" }
      ],
      steps: ["Butter one side of each bread slice.", "Place cheese between unbuttered sides.", "Cook in skillet until golden on both sides."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "quick", tag_value: "under-15" }],
      image_prompt: "Golden crispy grilled cheese sandwich cut in half showing melted cheese stretching, on a white plate, food photography"
    }
  ]
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
    const { cuisine, batchSize = 5 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_AI_STUDIO_GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Get recipes for the specified cuisine or all cuisines
    let recipesToSeed: typeof recipesByCuisine[string] = [];
    
    if (cuisine && recipesByCuisine[cuisine]) {
      recipesToSeed = recipesByCuisine[cuisine];
    } else {
      // Flatten all cuisines
      for (const cuisineRecipes of Object.values(recipesByCuisine)) {
        recipesToSeed = recipesToSeed.concat(cuisineRecipes);
      }
    }

    // Limit batch size
    recipesToSeed = recipesToSeed.slice(0, batchSize);

    if (recipesToSeed.length === 0) {
      return new Response(JSON.stringify({ message: "No recipes to seed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ title: string; status: string; error?: string }> = [];

    for (const recipe of recipesToSeed) {
      try {
        console.log(`Seeding: ${recipe.title}`);

        // Check if recipe already exists
        const { data: existing } = await supabase
          .from("recipes")
          .select("id")
          .eq("title", recipe.title)
          .eq("scope", "global")
          .single();

        if (existing) {
          results.push({ title: recipe.title, status: "skipped", error: "Already exists" });
          continue;
        }

        // Calculate serving size
        const servingSize = await calculateServingSize(
          recipe.title,
          recipe.servings,
          recipe.ingredients,
          genAI
        );

        // Generate image
        const imageUrl = await generateRecipeImage(
          recipe.title,
          recipe.description,
          recipe.ingredients,
          genAI,
          supabase
        );

        // Insert recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            title: recipe.title,
            description: recipe.description,
            prep_time: recipe.prep_time,
            cook_time: recipe.cook_time,
            total_time: recipe.total_time,
            servings: recipe.servings,
            serving_size: servingSize,
            difficulty: recipe.difficulty,
            cuisine: cuisine || "American",
            scope: "global",
            is_kid_friendly: recipe.is_kid_friendly,
            is_meal_prep_friendly: recipe.is_meal_prep_friendly,
            is_budget_friendly: recipe.is_budget_friendly,
            image_url: imageUrl,
          })
          .select()
          .single();

        if (recipeError) {
          throw new Error(`Failed to insert recipe: ${recipeError.message}`);
        }

        // Insert ingredients
        const ingredientsToInsert = recipe.ingredients.map((ing, index) => ({
          recipe_id: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          aisle: ing.aisle,
          order_index: index,
        }));

        await supabase.from("recipe_ingredients").insert(ingredientsToInsert);

        // Insert steps
        const stepsToInsert = recipe.steps.map((step, index) => ({
          recipe_id: newRecipe.id,
          step_number: index + 1,
          instruction: step,
        }));

        await supabase.from("recipe_steps").insert(stepsToInsert);

        // Insert nutrition
        await supabase.from("recipe_nutrition").insert({
          recipe_id: newRecipe.id,
          calories: recipe.calories,
          protein_g: recipe.protein_g,
          carbs_g: recipe.carbs_g,
          fat_g: recipe.fat_g,
          fiber_g: recipe.fiber_g,
          sodium_mg: recipe.sodium_mg,
          sugar_g: recipe.sugar_g || null,
          saturated_fat_g: recipe.saturated_fat_g || null,
          cholesterol_mg: recipe.cholesterol_mg || null,
        });

        // Insert tags
        if (recipe.tags.length > 0) {
          const tagsToInsert = recipe.tags.map(tag => ({
            recipe_id: newRecipe.id,
            tag_type: tag.tag_type,
            tag_value: tag.tag_value,
          }));
          await supabase.from("recipe_tags").insert(tagsToInsert);
        }

        results.push({ title: recipe.title, status: "success" });
        console.log(`✅ Seeded: ${recipe.title}`);

      } catch (error) {
        console.error(`❌ Failed ${recipe.title}:`, error);
        results.push({
          title: recipe.title,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;

    return new Response(
      JSON.stringify({
        message: `Seeded ${successCount} of ${recipesToSeed.length} recipes`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
