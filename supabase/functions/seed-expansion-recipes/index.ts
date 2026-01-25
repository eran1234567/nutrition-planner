import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-internal",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Generate ingredient-accurate recipe image using AI and upload to storage
async function generateRecipeImage(
  title: string,
  description: string,
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
  apiKey: string,
  supabase: any
): Promise<string | null> {
  const topIngredients = ingredients.slice(0, 5).map(i => i.name).join(", ");
  
  const prompt = `Professional food photography of "${title}". 
A beautifully plated dish showing these key ingredients: ${topIngredients}.
${description}
Shot from above at 45-degree angle, natural lighting, shallow depth of field, 
on a rustic wooden table with elegant ceramic plate. 
Ultra high resolution, appetizing, restaurant quality presentation.`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const base64Url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (base64Url && base64Url.startsWith("data:image")) {
        // Upload base64 to Supabase Storage
        const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        
        // Generate slug for filename
        const slug = title
          .toLowerCase()
          .replace(/['']/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        const fileName = `${slug}.jpg`;
        
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
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from("recipe-images")
          .getPublicUrl(`global/${fileName}`);
        
        console.log(`Generated and uploaded image for: ${title}`);
        return urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error(`Error generating image for ${title}:`, err);
  }
  return null;
}

// Calculate AI-powered serving size description
async function calculateServingSize(
  title: string,
  servings: number,
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  apiKey: string
): Promise<string> {
  const ingredientsList = ingredients
    .map((ing) => `${ing.quantity || ""} ${ing.unit || ""} ${ing.name}`.trim())
    .join(", ");

  const prompt = `Given this recipe with ${servings} servings:
Title: ${title}
Ingredients: ${ingredientsList}

Calculate what ONE SERVING equals in terms of the COMPLETED DISH with SPECIFIC COUNTS.

CRITICAL CALCULATION RULES:
1. For countable protein items (chicken tenders, wings, drumsticks, meatballs, patties):
   - Calculate: total quantity ÷ number of servings = pieces per serving
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders ÷ 4 servings = "3 chicken tenders"

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use weight per serving: "6 oz salmon"

3. For non-countable items (soups, stews, rice dishes, salads, curries):
   - Use volume: "1.5 cups curry" or "1 bowl soup"

4. For multi-component dishes:
   - Combine protein count + sides: "2 lamb chops + 1 cup rice"

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a nutrition assistant. Respond with ONLY the serving size description." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      let servingSize = data.choices?.[0]?.message?.content?.trim();
      if (servingSize) {
        return servingSize
          .replace(/^["']|["']$/g, "")
          .replace(/^\*+|\*+$/g, "")
          .substring(0, 100);
      }
    }
  } catch (err) {
    console.error("Error calculating serving size:", err);
  }
  return "1 serving";
}

// ============================================================================
// EXPANSION RECIPES - Balanced across underrepresented cuisines and health types
// ============================================================================
// Focus areas:
// - Cuisines: Indian (8), Thai (8), Japanese (8), French (6), Greek (6), Korean (4), Vietnamese (4), Middle Eastern (6)
// - Health: More diabetes-friendly, kidney-friendly, heart-healthy, low-sodium
// - Diets: More paleo, gluten-free options
// ============================================================================

interface Recipe {
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  difficulty: string;
  cuisine: string;
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
  ingredients: Array<{ name: string; quantity: number; unit: string; aisle: string }>;
  steps: string[];
  tags: Array<{ tag_type: string; tag_value: string }>;
}

const expansionRecipes: Record<string, Recipe[]> = {
  Indian: [
    {
      title: "Saag Paneer",
      description: "Creamy spinach curry with soft paneer cheese cubes",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "medium",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 18, carbs_g: 12, fat_g: 24, fiber_g: 5, sodium_mg: 280,
      ingredients: [
        { name: "Fresh spinach", quantity: 1, unit: "lb", aisle: "Produce" },
        { name: "Paneer cheese", quantity: 12, unit: "oz", aisle: "Dairy" },
        { name: "Ginger", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" },
        { name: "Heavy cream", quantity: 0.5, unit: "cup", aisle: "Dairy" },
      ],
      steps: [
        "Blanch spinach and blend into smooth puree.",
        "Sauté ginger and garlic until fragrant.",
        "Add spinach puree and simmer with spices.",
        "Fold in paneer cubes and cream, cook 5 minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegetarian" },
        { tag_type: "diet", tag_value: "keto" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Lamb Rogan Josh",
      description: "Aromatic Kashmiri lamb curry with warm spices and yogurt",
      prep_time: 20, cook_time: 90, total_time: 110, servings: 6, difficulty: "medium",
      cuisine: "Indian",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 380, protein_g: 32, carbs_g: 8, fat_g: 24, fiber_g: 2, sodium_mg: 320,
      ingredients: [
        { name: "Lamb shoulder", quantity: 2, unit: "lbs", aisle: "Meat" },
        { name: "Greek yogurt", quantity: 1, unit: "cup", aisle: "Dairy" },
        { name: "Kashmiri chili powder", quantity: 2, unit: "tbsp", aisle: "Spices" },
        { name: "Garam masala", quantity: 1, unit: "tbsp", aisle: "Spices" },
        { name: "Fresh ginger", quantity: 3, unit: "tbsp", aisle: "Produce" },
      ],
      steps: [
        "Brown lamb pieces in batches.",
        "Sauté onions with spices until deeply golden.",
        "Add yogurt and lamb, simmer 90 minutes until tender.",
        "Finish with fresh coriander.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "lamb" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Aloo Gobi",
      description: "Turmeric-spiced cauliflower and potato stir-fry",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 28, fat_g: 7, fiber_g: 6, sodium_mg: 180,
      ingredients: [
        { name: "Cauliflower", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Potatoes", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Turmeric", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Cumin seeds", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Fresh cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Cut cauliflower into florets, cube potatoes.",
        "Temper cumin seeds in hot oil.",
        "Add vegetables and spices, cook covered 20 minutes.",
        "Garnish with fresh cilantro.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "low-sodium" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Chicken Korma",
      description: "Mild creamy chicken curry with cashews and aromatic spices",
      prep_time: 20, cook_time: 35, total_time: 55, servings: 4, difficulty: "medium",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 36, carbs_g: 14, fat_g: 26, fiber_g: 3, sodium_mg: 380,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Cashews", quantity: 0.5, unit: "cup", aisle: "Nuts" },
        { name: "Coconut cream", quantity: 1, unit: "cup", aisle: "Canned Goods" },
        { name: "Onions", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Cardamom pods", quantity: 6, unit: "pods", aisle: "Spices" },
      ],
      steps: [
        "Blend cashews with water to make paste.",
        "Sauté onions until caramelized.",
        "Add chicken and spices, cook 15 minutes.",
        "Stir in cashew paste and coconut cream, simmer 20 minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Masoor Dal",
      description: "Comforting red lentil soup with cumin and tomatoes",
      prep_time: 10, cook_time: 30, total_time: 40, servings: 6, difficulty: "easy",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 14, carbs_g: 36, fat_g: 4, fiber_g: 12, sodium_mg: 180,
      ingredients: [
        { name: "Red lentils", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Tomatoes", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Cumin seeds", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Turmeric", quantity: 0.5, unit: "tsp", aisle: "Spices" },
        { name: "Ghee", quantity: 2, unit: "tbsp", aisle: "Dairy" },
      ],
      steps: [
        "Rinse lentils and cook with turmeric until soft.",
        "Make tadka by heating ghee with cumin seeds.",
        "Add tomatoes to tadka and cook briefly.",
        "Pour tadka over dal and serve with rice.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegetarian" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Vegetable Biryani",
      description: "Fragrant layered rice with mixed vegetables and aromatic spices",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 6, difficulty: "medium",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 8, carbs_g: 58, fat_g: 10, fiber_g: 5, sodium_mg: 320,
      ingredients: [
        { name: "Basmati rice", quantity: 2, unit: "cups", aisle: "Grains" },
        { name: "Mixed vegetables", quantity: 3, unit: "cups", aisle: "Produce" },
        { name: "Saffron", quantity: 0.5, unit: "tsp", aisle: "Spices" },
        { name: "Fried onions", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Mint leaves", quantity: 0.5, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Parboil rice with whole spices.",
        "Cook vegetables with biryani masala.",
        "Layer rice and vegetables, top with saffron milk.",
        "Cover and cook on low heat 20 minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegetarian" },
      ],
    },
    {
      title: "Fish Tikka",
      description: "Tandoori-spiced fish skewers with yogurt marinade",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "easy",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 240, protein_g: 32, carbs_g: 6, fat_g: 10, fiber_g: 1, sodium_mg: 290,
      ingredients: [
        { name: "Cod fillets", quantity: 1.5, unit: "lbs", aisle: "Seafood" },
        { name: "Greek yogurt", quantity: 0.5, unit: "cup", aisle: "Dairy" },
        { name: "Tandoori masala", quantity: 2, unit: "tbsp", aisle: "Spices" },
        { name: "Lemon", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Ginger-garlic paste", quantity: 2, unit: "tbsp", aisle: "Produce" },
      ],
      steps: [
        "Cut fish into 2-inch cubes.",
        "Marinate in yogurt and spices for 30 minutes.",
        "Thread onto skewers and grill 4-5 minutes per side.",
        "Serve with lemon wedges and mint chutney.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "fish" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Egg Curry",
      description: "Hard-boiled eggs in spiced tomato-onion gravy",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Indian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 16, carbs_g: 12, fat_g: 20, fiber_g: 3, sodium_mg: 320,
      ingredients: [
        { name: "Eggs", quantity: 8, unit: "large", aisle: "Dairy" },
        { name: "Onions", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Tomatoes", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Garam masala", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Fresh coriander", quantity: 0.25, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Hard boil eggs and halve them.",
        "Sauté onions until golden, add tomatoes and spices.",
        "Simmer gravy 15 minutes until thick.",
        "Add eggs and cook 5 more minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegetarian" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
  ],
  Thai: [
    {
      title: "Tom Kha Gai",
      description: "Coconut chicken soup with galangal and lemongrass",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 24, carbs_g: 12, fat_g: 22, fiber_g: 2, sodium_mg: 380,
      ingredients: [
        { name: "Chicken breast", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Coconut milk", quantity: 2, unit: "cans", aisle: "Canned Goods" },
        { name: "Galangal", quantity: 3, unit: "slices", aisle: "Produce" },
        { name: "Lemongrass", quantity: 2, unit: "stalks", aisle: "Produce" },
        { name: "Mushrooms", quantity: 8, unit: "oz", aisle: "Produce" },
      ],
      steps: [
        "Simmer coconut milk with galangal and lemongrass.",
        "Add sliced chicken and mushrooms.",
        "Cook until chicken is done, about 15 minutes.",
        "Finish with lime juice and fish sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Papaya Salad (Som Tam)",
      description: "Spicy green papaya salad with lime and peanuts",
      prep_time: 20, cook_time: 0, total_time: 20, servings: 2, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 6, carbs_g: 24, fat_g: 8, fiber_g: 5, sodium_mg: 420,
      ingredients: [
        { name: "Green papaya", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Cherry tomatoes", quantity: 8, unit: "whole", aisle: "Produce" },
        { name: "Thai chilies", quantity: 3, unit: "whole", aisle: "Produce" },
        { name: "Roasted peanuts", quantity: 0.25, unit: "cup", aisle: "Nuts" },
        { name: "Lime", quantity: 2, unit: "whole", aisle: "Produce" },
      ],
      steps: [
        "Shred green papaya into thin strips.",
        "Pound chilies and garlic in mortar.",
        "Add papaya, tomatoes, and dressing ingredients.",
        "Toss with peanuts and dried shrimp.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Panang Curry",
      description: "Rich red curry with peanuts and kaffir lime leaves",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 28, carbs_g: 14, fat_g: 26, fiber_g: 3, sodium_mg: 480,
      ingredients: [
        { name: "Beef sirloin", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Panang curry paste", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Coconut milk", quantity: 1, unit: "can", aisle: "Canned Goods" },
        { name: "Kaffir lime leaves", quantity: 4, unit: "leaves", aisle: "Produce" },
        { name: "Thai basil", quantity: 0.5, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Fry curry paste in coconut cream until fragrant.",
        "Add sliced beef and cook 5 minutes.",
        "Pour in remaining coconut milk and lime leaves.",
        "Simmer 15 minutes, finish with basil.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "beef" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Mango Sticky Rice",
      description: "Sweet coconut sticky rice with fresh ripe mango",
      prep_time: 30, cook_time: 30, total_time: 60, servings: 4, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 380, protein_g: 4, carbs_g: 72, fat_g: 10, fiber_g: 3, sodium_mg: 80,
      ingredients: [
        { name: "Sticky rice", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Coconut milk", quantity: 1, unit: "can", aisle: "Canned Goods" },
        { name: "Ripe mangoes", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Palm sugar", quantity: 0.25, unit: "cup", aisle: "Baking" },
        { name: "Sesame seeds", quantity: 1, unit: "tbsp", aisle: "Baking" },
      ],
      steps: [
        "Soak sticky rice 4 hours, then steam until tender.",
        "Warm coconut milk with sugar and salt.",
        "Mix rice with coconut sauce, let absorb 30 minutes.",
        "Serve with sliced mango and extra coconut drizzle.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Crying Tiger (Suea Rong Hai)",
      description: "Grilled beef steak with spicy tamarind dipping sauce",
      prep_time: 15, cook_time: 12, total_time: 27, servings: 4, difficulty: "medium",
      cuisine: "Thai",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 340, protein_g: 36, carbs_g: 8, fat_g: 18, fiber_g: 1, sodium_mg: 380,
      ingredients: [
        { name: "Ribeye steak", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Tamarind paste", quantity: 2, unit: "tbsp", aisle: "Asian" },
        { name: "Fish sauce", quantity: 2, unit: "tbsp", aisle: "Asian" },
        { name: "Thai chilies", quantity: 5, unit: "whole", aisle: "Produce" },
        { name: "Cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Season steak and grill to medium-rare, about 5 min per side.",
        "Rest meat 5 minutes, then slice against grain.",
        "Mix tamarind, fish sauce, chilies for dipping sauce.",
        "Serve steak with sauce and fresh vegetables.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "beef" },
        { tag_type: "diet", tag_value: "paleo" },
        { tag_type: "diet", tag_value: "keto" },
      ],
    },
    {
      title: "Khao Pad (Thai Fried Rice)",
      description: "Wok-fried jasmine rice with egg, vegetables, and protein",
      prep_time: 10, cook_time: 10, total_time: 20, servings: 2, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 18, carbs_g: 52, fat_g: 16, fiber_g: 3, sodium_mg: 580,
      ingredients: [
        { name: "Jasmine rice", quantity: 3, unit: "cups", aisle: "Grains" },
        { name: "Shrimp", quantity: 8, unit: "oz", aisle: "Seafood" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" },
        { name: "Green onions", quantity: 4, unit: "stalks", aisle: "Produce" },
        { name: "Cucumber", quantity: 1, unit: "small", aisle: "Produce" },
      ],
      steps: [
        "Use day-old cold rice for best results.",
        "Stir-fry shrimp and set aside.",
        "Scramble eggs, add rice and stir-fry on high heat.",
        "Add shrimp back, season with fish sauce and white pepper.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "shrimp" },
        { tag_type: "quick", tag_value: "under-30" },
      ],
    },
    {
      title: "Larb Gai (Chicken Larb)",
      description: "Spicy minced chicken salad with mint and toasted rice",
      prep_time: 15, cook_time: 10, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 28, carbs_g: 8, fat_g: 10, fiber_g: 2, sodium_mg: 420,
      ingredients: [
        { name: "Ground chicken", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Shallots", quantity: 4, unit: "small", aisle: "Produce" },
        { name: "Mint leaves", quantity: 0.5, unit: "cup", aisle: "Produce" },
        { name: "Toasted rice powder", quantity: 2, unit: "tbsp", aisle: "Asian" },
        { name: "Thai chilies", quantity: 4, unit: "whole", aisle: "Produce" },
      ],
      steps: [
        "Cook chicken in water until just done.",
        "Mix with lime juice, fish sauce, and chilies.",
        "Add shallots, mint, and toasted rice powder.",
        "Serve with cabbage leaves and sticky rice.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Satay with Peanut Sauce",
      description: "Grilled marinated chicken skewers with creamy peanut dip",
      prep_time: 30, cook_time: 15, total_time: 45, servings: 4, difficulty: "easy",
      cuisine: "Thai",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 32, carbs_g: 12, fat_g: 20, fiber_g: 2, sodium_mg: 420,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Peanut butter", quantity: 0.5, unit: "cup", aisle: "Spreads" },
        { name: "Coconut milk", quantity: 0.5, unit: "cup", aisle: "Canned Goods" },
        { name: "Turmeric", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Cucumber", quantity: 1, unit: "medium", aisle: "Produce" },
      ],
      steps: [
        "Marinate chicken strips with turmeric and coconut milk.",
        "Thread onto skewers and grill 3-4 minutes per side.",
        "Make peanut sauce by mixing peanut butter, coconut milk, and spices.",
        "Serve with cucumber relish and peanut sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
  ],
  Japanese: [
    {
      title: "Salmon Teriyaki",
      description: "Glazed salmon fillet with sweet soy teriyaki sauce",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 360, protein_g: 34, carbs_g: 18, fat_g: 16, fiber_g: 0, sodium_mg: 580,
      ingredients: [
        { name: "Salmon fillets", quantity: 4, unit: "6oz pieces", aisle: "Seafood" },
        { name: "Soy sauce", quantity: 0.25, unit: "cup", aisle: "Asian" },
        { name: "Mirin", quantity: 0.25, unit: "cup", aisle: "Asian" },
        { name: "Sake", quantity: 2, unit: "tbsp", aisle: "Beverages" },
        { name: "Ginger", quantity: 1, unit: "tbsp", aisle: "Produce" },
      ],
      steps: [
        "Mix soy sauce, mirin, sake, and sugar for teriyaki sauce.",
        "Sear salmon skin-side up 3 minutes.",
        "Flip and add sauce, cook 5-7 minutes basting frequently.",
        "Serve with steamed rice and garnish with sesame.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "fish" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Oyakodon",
      description: "Chicken and egg rice bowl with dashi broth",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 2, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 32, carbs_g: 52, fat_g: 14, fiber_g: 1, sodium_mg: 680,
      ingredients: [
        { name: "Chicken thighs", quantity: 0.5, unit: "lb", aisle: "Meat" },
        { name: "Eggs", quantity: 4, unit: "large", aisle: "Dairy" },
        { name: "Dashi stock", quantity: 1, unit: "cup", aisle: "Asian" },
        { name: "Onion", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Short grain rice", quantity: 2, unit: "cups", aisle: "Grains" },
      ],
      steps: [
        "Simmer sliced chicken and onion in dashi with soy sauce.",
        "Beat eggs lightly and pour over chicken.",
        "Cover and cook until eggs are just set.",
        "Slide over steaming hot rice in bowl.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "quick", tag_value: "under-30" },
      ],
    },
    {
      title: "Miso Glazed Eggplant (Nasu Dengaku)",
      description: "Broiled eggplant with sweet miso glaze and sesame",
      prep_time: 10, cook_time: 20, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 24, fat_g: 8, fiber_g: 6, sodium_mg: 420,
      ingredients: [
        { name: "Japanese eggplant", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "White miso paste", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Mirin", quantity: 2, unit: "tbsp", aisle: "Asian" },
        { name: "Sesame seeds", quantity: 1, unit: "tbsp", aisle: "Baking" },
        { name: "Green onions", quantity: 2, unit: "stalks", aisle: "Produce" },
      ],
      steps: [
        "Halve eggplants and score the flesh.",
        "Brush with oil and broil cut-side up 10 minutes.",
        "Mix miso, mirin, and sugar for glaze.",
        "Spread glaze and broil 5 more minutes until caramelized.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
    {
      title: "Tonkatsu",
      description: "Crispy breaded pork cutlet with tangy sauce",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 32, carbs_g: 28, fat_g: 26, fiber_g: 2, sodium_mg: 580,
      ingredients: [
        { name: "Pork loin cutlets", quantity: 4, unit: "6oz pieces", aisle: "Meat" },
        { name: "Panko breadcrumbs", quantity: 2, unit: "cups", aisle: "Baking" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" },
        { name: "Cabbage", quantity: 0.5, unit: "head", aisle: "Produce" },
        { name: "Tonkatsu sauce", quantity: 0.5, unit: "cup", aisle: "Asian" },
      ],
      steps: [
        "Pound pork to even thickness, season with salt and pepper.",
        "Coat in flour, egg, then panko pressing firmly.",
        "Deep fry at 350°F for 5-6 minutes until golden.",
        "Slice and serve with shredded cabbage and sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "pork" },
      ],
    },
    {
      title: "Edamame with Sea Salt",
      description: "Steamed young soybeans with flaky sea salt",
      prep_time: 2, cook_time: 5, total_time: 7, servings: 4, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 120, protein_g: 11, carbs_g: 10, fat_g: 5, fiber_g: 5, sodium_mg: 180,
      ingredients: [
        { name: "Edamame pods", quantity: 1, unit: "lb", aisle: "Frozen" },
        { name: "Sea salt", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Water", quantity: 4, unit: "cups", aisle: "Beverages" },
      ],
      steps: [
        "Bring salted water to boil.",
        "Add edamame and cook 5 minutes.",
        "Drain and toss with sea salt.",
        "Serve warm or at room temperature.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
        { tag_type: "quick", tag_value: "under-15" },
      ],
    },
    {
      title: "Yakitori",
      description: "Grilled chicken skewers with tare glaze",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 32, carbs_g: 12, fat_g: 12, fiber_g: 0, sodium_mg: 520,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Soy sauce", quantity: 0.5, unit: "cup", aisle: "Asian" },
        { name: "Mirin", quantity: 0.25, unit: "cup", aisle: "Asian" },
        { name: "Green onions", quantity: 8, unit: "stalks", aisle: "Produce" },
        { name: "Shichimi togarashi", quantity: 1, unit: "tsp", aisle: "Spices" },
      ],
      steps: [
        "Cut chicken into bite-sized pieces.",
        "Make tare sauce by simmering soy, mirin, and sugar.",
        "Thread chicken and green onion onto skewers.",
        "Grill while basting with tare sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
      ],
    },
    {
      title: "Sunomono (Cucumber Salad)",
      description: "Refreshing vinegared cucumber with sesame",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 4, difficulty: "easy",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 45, protein_g: 1, carbs_g: 8, fat_g: 1, fiber_g: 1, sodium_mg: 280,
      ingredients: [
        { name: "Japanese cucumber", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Rice vinegar", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Sugar", quantity: 1, unit: "tbsp", aisle: "Baking" },
        { name: "Sesame seeds", quantity: 1, unit: "tbsp", aisle: "Baking" },
        { name: "Wakame seaweed", quantity: 2, unit: "tbsp", aisle: "Asian" },
      ],
      steps: [
        "Slice cucumbers paper thin, salt and let drain 10 minutes.",
        "Squeeze out excess water.",
        "Mix vinegar, sugar, and soy sauce for dressing.",
        "Toss cucumber with dressing, wakame, and sesame.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "low-sodium" },
        { tag_type: "quick", tag_value: "under-15" },
      ],
    },
    {
      title: "Chawanmushi",
      description: "Silky steamed egg custard with shrimp and mushrooms",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "medium",
      cuisine: "Japanese",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 140, protein_g: 12, carbs_g: 4, fat_g: 8, fiber_g: 0, sodium_mg: 380,
      ingredients: [
        { name: "Eggs", quantity: 4, unit: "large", aisle: "Dairy" },
        { name: "Dashi stock", quantity: 2, unit: "cups", aisle: "Asian" },
        { name: "Shrimp", quantity: 8, unit: "medium", aisle: "Seafood" },
        { name: "Shiitake mushrooms", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "Mitsuba", quantity: 4, unit: "sprigs", aisle: "Produce" },
      ],
      steps: [
        "Beat eggs gently and mix with warm dashi.",
        "Strain mixture into cups with shrimp and mushrooms.",
        "Cover and steam over low heat 15-20 minutes.",
        "Garnish with mitsuba and serve warm.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "breakfast" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
  ],
  French: [
    {
      title: "Coq au Vin Blanc",
      description: "Chicken braised in white wine with pearl onions and mushrooms",
      prep_time: 30, cook_time: 90, total_time: 120, servings: 6, difficulty: "medium",
      cuisine: "French",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 38, carbs_g: 12, fat_g: 22, fiber_g: 2, sodium_mg: 480,
      ingredients: [
        { name: "Chicken pieces", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "White wine", quantity: 2, unit: "cups", aisle: "Beverages" },
        { name: "Pearl onions", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Cremini mushrooms", quantity: 12, unit: "oz", aisle: "Produce" },
        { name: "Fresh tarragon", quantity: 3, unit: "tbsp", aisle: "Produce" },
      ],
      steps: [
        "Brown chicken pieces and set aside.",
        "Sauté onions and mushrooms in the same pan.",
        "Add wine and chicken, braise covered 90 minutes.",
        "Finish with cream and fresh tarragon.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Niçoise Salad",
      description: "Provençal salad with tuna, eggs, olives, and green beans",
      prep_time: 25, cook_time: 15, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "French",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 28, carbs_g: 18, fat_g: 24, fiber_g: 5, sodium_mg: 520,
      ingredients: [
        { name: "Seared tuna", quantity: 1, unit: "lb", aisle: "Seafood" },
        { name: "Hard-boiled eggs", quantity: 4, unit: "large", aisle: "Dairy" },
        { name: "Green beans", quantity: 8, unit: "oz", aisle: "Produce" },
        { name: "Niçoise olives", quantity: 0.5, unit: "cup", aisle: "Olives" },
        { name: "Baby potatoes", quantity: 1, unit: "lb", aisle: "Produce" },
      ],
      steps: [
        "Boil potatoes and green beans until tender.",
        "Sear tuna to medium-rare, slice.",
        "Arrange all components on platter with greens.",
        "Drizzle with Dijon vinaigrette.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "protein", tag_value: "fish" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Duck Confit",
      description: "Slow-cooked duck legs in their own fat until fall-off-the-bone tender",
      prep_time: 24, cook_time: 180, total_time: 1620, servings: 4, difficulty: "hard",
      cuisine: "French",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 520, protein_g: 32, carbs_g: 2, fat_g: 42, fiber_g: 0, sodium_mg: 380,
      ingredients: [
        { name: "Duck legs", quantity: 4, unit: "pieces", aisle: "Meat" },
        { name: "Duck fat", quantity: 3, unit: "cups", aisle: "Meat" },
        { name: "Kosher salt", quantity: 3, unit: "tbsp", aisle: "Spices" },
        { name: "Garlic", quantity: 6, unit: "cloves", aisle: "Produce" },
        { name: "Fresh thyme", quantity: 6, unit: "sprigs", aisle: "Produce" },
      ],
      steps: [
        "Salt duck legs generously and cure overnight.",
        "Rinse, pat dry, and submerge in duck fat.",
        "Cook at 250°F for 3 hours until tender.",
        "Crisp skin under broiler before serving.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "keto" },
        { tag_type: "diet", tag_value: "paleo" },
      ],
    },
    {
      title: "Soupe à l'Oignon",
      description: "Classic French onion soup with Gruyère crouton",
      prep_time: 20, cook_time: 60, total_time: 80, servings: 6, difficulty: "medium",
      cuisine: "French",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 14, carbs_g: 28, fat_g: 18, fiber_g: 3, sodium_mg: 680,
      ingredients: [
        { name: "Yellow onions", quantity: 3, unit: "lbs", aisle: "Produce" },
        { name: "Beef broth", quantity: 8, unit: "cups", aisle: "Canned Goods" },
        { name: "Gruyère cheese", quantity: 2, unit: "cups", aisle: "Dairy" },
        { name: "Baguette", quantity: 1, unit: "loaf", aisle: "Bakery" },
        { name: "Dry white wine", quantity: 1, unit: "cup", aisle: "Beverages" },
      ],
      steps: [
        "Caramelize onions slowly for 45 minutes.",
        "Add wine and broth, simmer 15 minutes.",
        "Ladle into oven-safe bowls, top with bread and cheese.",
        "Broil until cheese is bubbly and golden.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegetarian" },
      ],
    },
    {
      title: "Ratatouille",
      description: "Provençal vegetable stew with eggplant, zucchini, and tomatoes",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 6, difficulty: "medium",
      cuisine: "French",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 160, protein_g: 4, carbs_g: 18, fat_g: 9, fiber_g: 6, sodium_mg: 180,
      ingredients: [
        { name: "Eggplant", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Zucchini", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Bell peppers", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Roma tomatoes", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "Fresh basil", quantity: 0.25, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Slice all vegetables into thin rounds.",
        "Make tomato sauce base with crushed tomatoes and herbs.",
        "Arrange vegetable slices in spiral pattern over sauce.",
        "Bake covered at 375°F for 45 minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "low-sodium" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Bouillabaisse",
      description: "Marseille-style seafood stew with saffron broth",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 6, difficulty: "hard",
      cuisine: "French",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 380, protein_g: 42, carbs_g: 12, fat_g: 18, fiber_g: 2, sodium_mg: 480,
      ingredients: [
        { name: "Mixed firm fish", quantity: 2, unit: "lbs", aisle: "Seafood" },
        { name: "Mussels", quantity: 1, unit: "lb", aisle: "Seafood" },
        { name: "Saffron threads", quantity: 0.5, unit: "tsp", aisle: "Spices" },
        { name: "Fennel bulb", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Orange zest", quantity: 2, unit: "strips", aisle: "Produce" },
      ],
      steps: [
        "Make stock with fish bones, fennel, and aromatics.",
        "Sauté vegetables, add saffron and tomatoes.",
        "Add firm fish first, then delicate fish and shellfish.",
        "Serve with rouille and crusty bread.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "fish" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "diet", tag_value: "pescatarian" },
      ],
    },
  ],
  Greek: [
    {
      title: "Pastitsio",
      description: "Greek baked pasta with meat sauce and creamy béchamel",
      prep_time: 40, cook_time: 50, total_time: 90, servings: 8, difficulty: "medium",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 520, protein_g: 28, carbs_g: 42, fat_g: 26, fiber_g: 3, sodium_mg: 580,
      ingredients: [
        { name: "Bucatini pasta", quantity: 1, unit: "lb", aisle: "Pasta" },
        { name: "Ground lamb", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Béchamel sauce", quantity: 4, unit: "cups", aisle: "Dairy" },
        { name: "Cinnamon", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Kefalotyri cheese", quantity: 1, unit: "cup", aisle: "Dairy" },
      ],
      steps: [
        "Cook pasta and mix with egg and cheese.",
        "Brown lamb with tomatoes, cinnamon, and allspice.",
        "Layer pasta, meat sauce, more pasta, then béchamel.",
        "Bake at 350°F for 50 minutes until golden.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "lamb" },
      ],
    },
    {
      title: "Horiatiki (Village Salad)",
      description: "Traditional Greek salad with tomatoes, cucumber, feta, and olives",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 4, difficulty: "easy",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 220, protein_g: 8, carbs_g: 12, fat_g: 16, fiber_g: 3, sodium_mg: 480,
      ingredients: [
        { name: "Ripe tomatoes", quantity: 4, unit: "large", aisle: "Produce" },
        { name: "Cucumber", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Block feta cheese", quantity: 8, unit: "oz", aisle: "Dairy" },
        { name: "Kalamata olives", quantity: 0.5, unit: "cup", aisle: "Olives" },
        { name: "Red onion", quantity: 1, unit: "small", aisle: "Produce" },
      ],
      steps: [
        "Cut tomatoes into wedges, slice cucumber and onion.",
        "Arrange on platter, do not toss.",
        "Place whole feta block on top with olives.",
        "Drizzle with olive oil and dried oregano.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "diet", tag_value: "vegetarian" },
        { tag_type: "diet", tag_value: "mediterranean" },
        { tag_type: "quick", tag_value: "under-15" },
      ],
    },
    {
      title: "Dolmades",
      description: "Grape leaves stuffed with herbed rice and lemon",
      prep_time: 45, cook_time: 60, total_time: 105, servings: 8, difficulty: "medium",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 28, fat_g: 7, fiber_g: 3, sodium_mg: 320,
      ingredients: [
        { name: "Grape leaves", quantity: 1, unit: "jar", aisle: "International" },
        { name: "Long grain rice", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Fresh dill", quantity: 0.5, unit: "cup", aisle: "Produce" },
        { name: "Fresh mint", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lemons", quantity: 3, unit: "whole", aisle: "Produce" },
      ],
      steps: [
        "Rinse grape leaves and remove stems.",
        "Mix rice with herbs, olive oil, and lemon juice.",
        "Roll stuffed leaves tightly and pack in pot.",
        "Simmer in lemon water 60 minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "diet", tag_value: "mediterranean" },
      ],
    },
    {
      title: "Lamb Kleftiko",
      description: "Slow-roasted lamb with potatoes in parchment",
      prep_time: 25, cook_time: 180, total_time: 205, servings: 6, difficulty: "medium",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 480, protein_g: 38, carbs_g: 24, fat_g: 26, fiber_g: 3, sodium_mg: 380,
      ingredients: [
        { name: "Lamb shoulder", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "Potatoes", quantity: 2, unit: "lbs", aisle: "Produce" },
        { name: "Garlic", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Fresh oregano", quantity: 3, unit: "tbsp", aisle: "Produce" },
        { name: "Feta cheese", quantity: 8, unit: "oz", aisle: "Dairy" },
      ],
      steps: [
        "Cut slits in lamb and insert garlic slivers.",
        "Layer potatoes and lamb on parchment paper.",
        "Add oregano, lemon juice, and crumbled feta.",
        "Seal tightly and roast at 325°F for 3 hours.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "lamb" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Fasolada (White Bean Soup)",
      description: "Traditional Greek bean soup with tomatoes and olive oil",
      prep_time: 15, cook_time: 90, total_time: 105, servings: 8, difficulty: "easy",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 14, carbs_g: 42, fat_g: 8, fiber_g: 12, sodium_mg: 280,
      ingredients: [
        { name: "Dried white beans", quantity: 1, unit: "lb", aisle: "Canned Goods" },
        { name: "Carrots", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Celery", quantity: 3, unit: "stalks", aisle: "Produce" },
        { name: "Tomato paste", quantity: 3, unit: "tbsp", aisle: "Canned Goods" },
        { name: "Extra virgin olive oil", quantity: 0.5, unit: "cup", aisle: "Oils" },
      ],
      steps: [
        "Soak beans overnight, drain and rinse.",
        "Sauté vegetables until soft.",
        "Add beans, tomato paste, and water to cover.",
        "Simmer 90 minutes until beans are creamy.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "diet", tag_value: "mediterranean" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Galaktoboureko",
      description: "Semolina custard wrapped in crispy phyllo with citrus syrup",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 12, difficulty: "medium",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 8, carbs_g: 52, fat_g: 16, fiber_g: 1, sodium_mg: 180,
      ingredients: [
        { name: "Phyllo dough", quantity: 1, unit: "package", aisle: "Frozen" },
        { name: "Semolina", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Whole milk", quantity: 4, unit: "cups", aisle: "Dairy" },
        { name: "Sugar", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Orange zest", quantity: 2, unit: "tbsp", aisle: "Produce" },
      ],
      steps: [
        "Make semolina custard with milk, sugar, and eggs.",
        "Layer buttered phyllo in pan, add custard.",
        "Top with more phyllo, bake until golden.",
        "Pour cold citrus syrup over hot pastry.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegetarian" },
      ],
    },
  ],
  Korean: [
    {
      title: "Bulgogi",
      description: "Sweet soy-marinated grilled beef with garlic and pear",
      prep_time: 30, cook_time: 10, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Korean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 32, carbs_g: 18, fat_g: 16, fiber_g: 1, sodium_mg: 580,
      ingredients: [
        { name: "Beef sirloin", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Asian pear", quantity: 1, unit: "whole", aisle: "Produce" },
        { name: "Soy sauce", quantity: 0.5, unit: "cup", aisle: "Asian" },
        { name: "Sesame oil", quantity: 2, unit: "tbsp", aisle: "Oils" },
        { name: "Green onions", quantity: 6, unit: "stalks", aisle: "Produce" },
      ],
      steps: [
        "Slice beef very thin against the grain.",
        "Blend pear with garlic and ginger for marinade base.",
        "Marinate beef at least 30 minutes or overnight.",
        "Grill quickly over high heat until caramelized.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "beef" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Japchae",
      description: "Sweet potato glass noodles with vegetables and beef",
      prep_time: 30, cook_time: 20, total_time: 50, servings: 4, difficulty: "medium",
      cuisine: "Korean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 14, carbs_g: 48, fat_g: 10, fiber_g: 4, sodium_mg: 520,
      ingredients: [
        { name: "Sweet potato noodles", quantity: 8, unit: "oz", aisle: "Asian" },
        { name: "Spinach", quantity: 4, unit: "oz", aisle: "Produce" },
        { name: "Beef sirloin", quantity: 6, unit: "oz", aisle: "Meat" },
        { name: "Shiitake mushrooms", quantity: 6, unit: "medium", aisle: "Produce" },
        { name: "Carrots", quantity: 2, unit: "medium", aisle: "Produce" },
      ],
      steps: [
        "Cook noodles, drain and cut with scissors.",
        "Stir-fry each vegetable separately with seasoning.",
        "Stir-fry marinated beef strips.",
        "Toss everything together with soy sauce and sesame oil.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "beef" },
      ],
    },
    {
      title: "Kimchi Jjigae",
      description: "Spicy fermented cabbage stew with pork and tofu",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Korean",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 22, carbs_g: 12, fat_g: 18, fiber_g: 4, sodium_mg: 680,
      ingredients: [
        { name: "Aged kimchi", quantity: 2, unit: "cups", aisle: "Asian" },
        { name: "Pork belly", quantity: 8, unit: "oz", aisle: "Meat" },
        { name: "Firm tofu", quantity: 14, unit: "oz", aisle: "Produce" },
        { name: "Gochugaru", quantity: 1, unit: "tbsp", aisle: "Spices" },
        { name: "Green onions", quantity: 4, unit: "stalks", aisle: "Produce" },
      ],
      steps: [
        "Sauté pork belly until fat renders.",
        "Add kimchi and stir-fry 5 minutes.",
        "Add water and simmer 15 minutes.",
        "Add cubed tofu and cook 5 more minutes.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "pork" },
      ],
    },
    {
      title: "Bibimbap",
      description: "Mixed rice bowl with vegetables, beef, and gochujang",
      prep_time: 40, cook_time: 20, total_time: 60, servings: 4, difficulty: "medium",
      cuisine: "Korean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 520, protein_g: 24, carbs_g: 68, fat_g: 16, fiber_g: 6, sodium_mg: 580,
      ingredients: [
        { name: "Short grain rice", quantity: 2, unit: "cups", aisle: "Grains" },
        { name: "Ground beef", quantity: 8, unit: "oz", aisle: "Meat" },
        { name: "Zucchini", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Eggs", quantity: 4, unit: "large", aisle: "Dairy" },
        { name: "Gochujang", quantity: 4, unit: "tbsp", aisle: "Asian" },
      ],
      steps: [
        "Cook rice and prepare each vegetable separately.",
        "Season and cook beef with soy sauce.",
        "Arrange all toppings over rice in bowls.",
        "Top with fried egg and serve with gochujang.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "beef" },
      ],
    },
  ],
  Vietnamese: [
    {
      title: "Bun Cha",
      description: "Grilled pork meatballs with rice noodles and herbs",
      prep_time: 30, cook_time: 20, total_time: 50, servings: 4, difficulty: "medium",
      cuisine: "Vietnamese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 28, carbs_g: 48, fat_g: 14, fiber_g: 3, sodium_mg: 580,
      ingredients: [
        { name: "Ground pork", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Rice vermicelli", quantity: 8, unit: "oz", aisle: "Asian" },
        { name: "Fish sauce", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Fresh herbs", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Pickled carrots", quantity: 1, unit: "cup", aisle: "Asian" },
      ],
      steps: [
        "Form seasoned pork into meatballs and patties.",
        "Grill until charred and cooked through.",
        "Prepare dipping sauce with fish sauce, water, lime.",
        "Serve with noodles, herbs, and dipping sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "pork" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Banh Mi",
      description: "Vietnamese baguette with pork, pickled vegetables, and cilantro",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "easy",
      cuisine: "Vietnamese",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 24, carbs_g: 52, fat_g: 20, fiber_g: 4, sodium_mg: 780,
      ingredients: [
        { name: "Baguettes", quantity: 4, unit: "small", aisle: "Bakery" },
        { name: "Pork loin", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Pickled daikon", quantity: 1, unit: "cup", aisle: "Asian" },
        { name: "Fresh cilantro", quantity: 1, unit: "bunch", aisle: "Produce" },
        { name: "Jalapeño", quantity: 2, unit: "whole", aisle: "Produce" },
      ],
      steps: [
        "Marinate and grill pork slices.",
        "Toast baguettes until crispy outside.",
        "Spread pâté and mayo, add meat.",
        "Top with pickled vegetables, cilantro, jalapeño.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "protein", tag_value: "pork" },
      ],
    },
    {
      title: "Ca Kho To (Caramelized Fish)",
      description: "Catfish braised in caramel sauce in clay pot",
      prep_time: 15, cook_time: 30, total_time: 45, servings: 4, difficulty: "medium",
      cuisine: "Vietnamese",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 28, carbs_g: 18, fat_g: 14, fiber_g: 0, sodium_mg: 580,
      ingredients: [
        { name: "Catfish steaks", quantity: 1.5, unit: "lbs", aisle: "Seafood" },
        { name: "Sugar", quantity: 3, unit: "tbsp", aisle: "Baking" },
        { name: "Fish sauce", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Black pepper", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Shallots", quantity: 4, unit: "small", aisle: "Produce" },
      ],
      steps: [
        "Make caramel by cooking sugar until amber.",
        "Add fish sauce and coconut water carefully.",
        "Add fish and shallots, simmer 25 minutes.",
        "Serve over steaming rice.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "fish" },
        { tag_type: "diet", tag_value: "gluten-free" },
      ],
    },
    {
      title: "Goi Cuon (Fresh Spring Rolls)",
      description: "Rice paper rolls with shrimp, pork, herbs, and peanut sauce",
      prep_time: 30, cook_time: 10, total_time: 40, servings: 4, difficulty: "easy",
      cuisine: "Vietnamese",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 240, protein_g: 18, carbs_g: 28, fat_g: 6, fiber_g: 2, sodium_mg: 480,
      ingredients: [
        { name: "Rice paper wrappers", quantity: 12, unit: "sheets", aisle: "Asian" },
        { name: "Cooked shrimp", quantity: 12, unit: "large", aisle: "Seafood" },
        { name: "Rice vermicelli", quantity: 4, unit: "oz", aisle: "Asian" },
        { name: "Fresh mint", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Hoisin sauce", quantity: 0.5, unit: "cup", aisle: "Asian" },
      ],
      steps: [
        "Prepare all fillings and have ready.",
        "Dip rice paper briefly in warm water.",
        "Layer ingredients and roll tightly.",
        "Serve with peanut-hoisin dipping sauce.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "protein", tag_value: "shrimp" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
  ],
  MiddleEastern: [
    {
      title: "Mujadara",
      description: "Lebanese lentils and rice with caramelized onions",
      prep_time: 15, cook_time: 45, total_time: 60, servings: 6, difficulty: "easy",
      cuisine: "Middle Eastern",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 14, carbs_g: 56, fat_g: 6, fiber_g: 12, sodium_mg: 180,
      ingredients: [
        { name: "Brown lentils", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Basmati rice", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Yellow onions", quantity: 3, unit: "large", aisle: "Produce" },
        { name: "Cumin", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Olive oil", quantity: 0.5, unit: "cup", aisle: "Oils" },
      ],
      steps: [
        "Cook lentils until almost tender.",
        "Caramelize onions slowly until deep brown.",
        "Add rice to lentils and cook together.",
        "Top with crispy onions and serve with yogurt.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "low-sodium" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Kibbeh",
      description: "Bulgur and lamb croquettes with pine nuts and spices",
      prep_time: 45, cook_time: 30, total_time: 75, servings: 8, difficulty: "hard",
      cuisine: "Middle Eastern",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 340, protein_g: 18, carbs_g: 24, fat_g: 20, fiber_g: 4, sodium_mg: 380,
      ingredients: [
        { name: "Fine bulgur", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Ground lamb", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Pine nuts", quantity: 0.5, unit: "cup", aisle: "Nuts" },
        { name: "Onion", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Allspice", quantity: 1, unit: "tsp", aisle: "Spices" },
      ],
      steps: [
        "Soak bulgur and mix with half the lamb and spices.",
        "Make filling with remaining lamb, pine nuts, onions.",
        "Form shells and stuff with filling.",
        "Deep fry or bake until golden.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "lamb" },
      ],
    },
    {
      title: "Fattoush",
      description: "Lebanese bread salad with sumac dressing",
      prep_time: 20, cook_time: 10, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "Middle Eastern",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 220, protein_g: 6, carbs_g: 28, fat_g: 10, fiber_g: 5, sodium_mg: 320,
      ingredients: [
        { name: "Pita bread", quantity: 2, unit: "rounds", aisle: "Bakery" },
        { name: "Romaine lettuce", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Tomatoes", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Sumac", quantity: 2, unit: "tbsp", aisle: "Spices" },
        { name: "Purslane", quantity: 1, unit: "cup", aisle: "Produce" },
      ],
      steps: [
        "Toast or fry pita until crispy.",
        "Chop vegetables and fresh herbs.",
        "Make dressing with lemon, olive oil, sumac.",
        "Toss salad and add pita just before serving.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "lunch" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "diet", tag_value: "mediterranean" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Kofta Kebabs",
      description: "Spiced ground lamb skewers grilled over charcoal",
      prep_time: 20, cook_time: 12, total_time: 32, servings: 4, difficulty: "easy",
      cuisine: "Middle Eastern",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 26, carbs_g: 4, fat_g: 22, fiber_g: 1, sodium_mg: 420,
      ingredients: [
        { name: "Ground lamb", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Fresh parsley", quantity: 0.5, unit: "cup", aisle: "Produce" },
        { name: "Onion", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Cumin", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Coriander", quantity: 1, unit: "tsp", aisle: "Spices" },
      ],
      steps: [
        "Mix lamb with grated onion, herbs, and spices.",
        "Form around flat skewers in torpedo shapes.",
        "Grill over high heat 3-4 minutes per side.",
        "Serve with tahini sauce and flatbread.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "lamb" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "diet", tag_value: "keto" },
      ],
    },
    {
      title: "Makdous (Stuffed Eggplant)",
      description: "Baby eggplants stuffed with walnuts and preserved in olive oil",
      prep_time: 60, cook_time: 20, total_time: 80, servings: 12, difficulty: "medium",
      cuisine: "Middle Eastern",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 8, fat_g: 16, fiber_g: 4, sodium_mg: 280,
      ingredients: [
        { name: "Baby eggplants", quantity: 24, unit: "small", aisle: "Produce" },
        { name: "Walnuts", quantity: 1, unit: "cup", aisle: "Nuts" },
        { name: "Garlic", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Red pepper flakes", quantity: 2, unit: "tbsp", aisle: "Spices" },
        { name: "Olive oil", quantity: 2, unit: "cups", aisle: "Oils" },
      ],
      steps: [
        "Boil eggplants until tender, drain and press.",
        "Make filling with walnuts, garlic, and spices.",
        "Stuff eggplants and pack in jars.",
        "Cover with olive oil and cure 2 weeks.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "snack" },
        { tag_type: "diet", tag_value: "vegan" },
        { tag_type: "medical", tag_value: "heart-healthy" },
      ],
    },
    {
      title: "Shish Taouk",
      description: "Lebanese garlic-yogurt marinated chicken skewers",
      prep_time: 30, cook_time: 15, total_time: 45, servings: 4, difficulty: "easy",
      cuisine: "Middle Eastern",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 36, carbs_g: 6, fat_g: 12, fiber_g: 1, sodium_mg: 320,
      ingredients: [
        { name: "Chicken breast", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Greek yogurt", quantity: 1, unit: "cup", aisle: "Dairy" },
        { name: "Garlic", quantity: 6, unit: "cloves", aisle: "Produce" },
        { name: "Lemon juice", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Tomato paste", quantity: 2, unit: "tbsp", aisle: "Canned Goods" },
      ],
      steps: [
        "Cube chicken into 2-inch pieces.",
        "Marinate in yogurt, garlic, lemon at least 2 hours.",
        "Thread onto skewers and grill 4-5 minutes per side.",
        "Serve with garlic sauce and pickles.",
      ],
      tags: [
        { tag_type: "meal", tag_value: "dinner" },
        { tag_type: "protein", tag_value: "chicken" },
        { tag_type: "diet", tag_value: "gluten-free" },
        { tag_type: "medical", tag_value: "diabetes-friendly" },
      ],
    },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require internal header for access (Lovable agent only)
  const internalHeader = req.headers.get("X-Lovable-Internal");
  if (internalHeader !== "true") {
    return new Response(
      JSON.stringify({ error: "Unauthorized - internal use only" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional filters
    let body: { cuisine?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided
    }

    const targetCuisine = body.cuisine;
    const limit = body.limit || 100;

    const results: Array<{ cuisine: string; title: string; status: string; error?: string }> = [];
    let totalInserted = 0;
    let processedCount = 0;

    // Process recipes by cuisine
    for (const [cuisine, recipes] of Object.entries(expansionRecipes)) {
      if (targetCuisine && cuisine !== targetCuisine) continue;

      for (const recipe of recipes) {
        if (processedCount >= limit) break;

        // Check if recipe already exists
        const { data: existing } = await supabase
          .from("recipes")
          .select("id")
          .eq("title", recipe.title)
          .eq("scope", "global")
          .maybeSingle();

        if (existing) {
          results.push({ cuisine, title: recipe.title, status: "exists" });
          processedCount++;
          continue;
        }

        try {
          // Generate AI image based on ingredients
          console.log(`Generating image for: ${recipe.title}`);
          const imageUrl = await generateRecipeImage(
            recipe.title,
            recipe.description,
            recipe.ingredients,
            lovableApiKey,
            supabase
          );

          // Calculate serving size using AI
          const servingSize = await calculateServingSize(
            recipe.title,
            recipe.servings,
            recipe.ingredients,
            lovableApiKey
          );

          // Insert recipe
          const { data: recipeData, error: recipeError } = await supabase
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
              cuisine: recipe.cuisine,
              image_url: imageUrl,
              is_kid_friendly: recipe.is_kid_friendly,
              is_meal_prep_friendly: recipe.is_meal_prep_friendly,
              is_budget_friendly: recipe.is_budget_friendly,
              scope: "global",
            })
            .select("id")
            .single();

          if (recipeError || !recipeData) {
            throw new Error(`Recipe insert failed: ${recipeError?.message}`);
          }

          const recipeId = recipeData.id;

          // Insert nutrition
          await supabase.from("recipe_nutrition").insert({
            recipe_id: recipeId,
            calories: recipe.calories,
            protein_g: recipe.protein_g,
            carbs_g: recipe.carbs_g,
            fat_g: recipe.fat_g,
            fiber_g: recipe.fiber_g,
            sodium_mg: recipe.sodium_mg,
            sugar_g: recipe.sugar_g || null,
            saturated_fat_g: recipe.saturated_fat_g || null,
          });

          // Insert ingredients
          for (let i = 0; i < recipe.ingredients.length; i++) {
            const ing = recipe.ingredients[i];
            await supabase.from("recipe_ingredients").insert({
              recipe_id: recipeId,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              aisle: ing.aisle,
              order_index: i,
              normalized_name: ing.name.toLowerCase(),
            });
          }

          // Insert steps
          for (let i = 0; i < recipe.steps.length; i++) {
            await supabase.from("recipe_steps").insert({
              recipe_id: recipeId,
              step_number: i + 1,
              instruction: recipe.steps[i],
            });
          }

          // Insert tags
          for (const tag of recipe.tags) {
            await supabase.from("recipe_tags").insert({
              recipe_id: recipeId,
              tag_type: tag.tag_type,
              tag_value: tag.tag_value,
            });
          }

          results.push({ cuisine, title: recipe.title, status: "inserted" });
          totalInserted++;

        } catch (err) {
          console.error(`Error inserting ${recipe.title}:`, err);
          results.push({
            cuisine,
            title: recipe.title,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }

        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalInserted,
        totalProcessed: processedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Seed expansion error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
