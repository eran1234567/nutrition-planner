import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Generate AI image based on recipe title and ingredients for accuracy
async function generateRecipeImage(
  title: string,
  description: string,
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
  apiKey: string
): Promise<string | null> {
  // Build ingredient list for accurate image generation
  const mainIngredients = ingredients
    .slice(0, 5) // Top 5 ingredients are most important
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
    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text']
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (generatedImageUrl) {
        console.log(`Image generated for: ${title}`);
        return generatedImageUrl;
      }
    } else {
      console.error(`Image generation failed for ${title}: ${response.status}`);
    }
  } catch (err) {
    console.error(`Error generating image for ${title}:`, err);
  }
  return null;
}

// Fallback: Generate image URL from recipe title by converting to kebab-case
function getStaticImageUrl(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `/recipe-images/${slug}.jpg`;
}

// Calculate serving_size using AI Chef rules
async function calculateServingSize(
  title: string,
  servings: number,
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  apiKey: string
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

Respond with ONLY the serving size description, no explanation. Keep it under 60 characters.`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a nutrition assistant. Respond with ONLY the serving size description, nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      let servingSize = data.choices?.[0]?.message?.content?.trim();
      if (servingSize) {
        return servingSize
          .replace(/^["']|["']$/g, '')
          .replace(/^\*+|\*+$/g, '')
          .substring(0, 100);
      }
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
    },
    {
      title: "BBQ Pulled Pork Sandwich",
      description: "Slow-cooked tender pulled pork with tangy BBQ sauce",
      prep_time: 15, cook_time: 240, total_time: 255, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 520, protein_g: 32, carbs_g: 42, fat_g: 22, fiber_g: 2, sodium_mg: 890,
      ingredients: [
        { name: "Pork shoulder", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "BBQ sauce", quantity: 1, unit: "cup", aisle: "Condiments" },
        { name: "Brioche buns", quantity: 8, unit: "buns", aisle: "Bakery" }
      ],
      steps: ["Season pork and slow cook for 4 hours.", "Shred pork and mix with BBQ sauce.", "Serve on toasted buns."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "BBQ pulled pork sandwich with coleslaw on brioche bun, tangy sauce dripping, food photography"
    },
    {
      title: "Buttermilk Fried Chicken",
      description: "Crispy Southern-style fried chicken marinated in buttermilk",
      prep_time: 30, cook_time: 25, total_time: 55, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 38, carbs_g: 24, fat_g: 26, fiber_g: 1, sodium_mg: 720,
      ingredients: [
        { name: "Chicken pieces", quantity: 8, unit: "pieces", aisle: "Meat" },
        { name: "Buttermilk", quantity: 2, unit: "cups", aisle: "Dairy" },
        { name: "Flour", quantity: 2, unit: "cups", aisle: "Baking" }
      ],
      steps: ["Marinate chicken in buttermilk overnight.", "Coat in seasoned flour.", "Fry until golden and cooked through."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Crispy golden fried chicken pieces on a plate with herbs, Southern comfort food, food photography"
    },
    {
      title: "Mac and Cheese",
      description: "Creamy homemade macaroni and cheese with a crispy breadcrumb topping",
      prep_time: 15, cook_time: 30, total_time: 45, servings: 6, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 16, carbs_g: 48, fat_g: 18, fiber_g: 2, sodium_mg: 580,
      ingredients: [
        { name: "Elbow macaroni", quantity: 1, unit: "lb", aisle: "Pasta" },
        { name: "Sharp cheddar", quantity: 3, unit: "cups", aisle: "Dairy" },
        { name: "Milk", quantity: 2, unit: "cups", aisle: "Dairy" }
      ],
      steps: ["Cook pasta and drain.", "Make cheese sauce with milk and cheese.", "Combine, top with breadcrumbs, bake until golden."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Baked mac and cheese in cast iron skillet with golden breadcrumb crust, creamy cheese sauce, food photography"
    },
    {
      title: "Chicken Caesar Salad",
      description: "Fresh romaine with grilled chicken, parmesan, and creamy Caesar dressing",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 2, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 32, carbs_g: 12, fat_g: 24, fiber_g: 4, sodium_mg: 620,
      ingredients: [
        { name: "Romaine lettuce", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Chicken breast", quantity: 2, unit: "pieces", aisle: "Meat" },
        { name: "Caesar dressing", quantity: 0.5, unit: "cup", aisle: "Condiments" }
      ],
      steps: ["Grill chicken until cooked through.", "Chop romaine and place in bowl.", "Top with sliced chicken, parmesan, and dressing."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Fresh chicken Caesar salad with grilled chicken strips, parmesan shavings, croutons, creamy dressing, food photography"
    }
  ],
  Italian: [
    {
      title: "Spaghetti Carbonara",
      description: "Classic Roman pasta with eggs, pecorino, guanciale, and black pepper",
      prep_time: 10, cook_time: 20, total_time: 30, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 520, protein_g: 22, carbs_g: 58, fat_g: 22, fiber_g: 2, sodium_mg: 680,
      ingredients: [
        { name: "Spaghetti", quantity: 1, unit: "lb", aisle: "Pasta" },
        { name: "Eggs", quantity: 4, unit: "large", aisle: "Dairy" },
        { name: "Pancetta", quantity: 8, unit: "oz", aisle: "Meat" }
      ],
      steps: ["Cook pasta al dente.", "Fry pancetta until crispy.", "Toss hot pasta with egg mixture and pancetta."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Creamy spaghetti carbonara with crispy pancetta, fresh cracked pepper, pecorino cheese, Italian cuisine, food photography"
    },
    {
      title: "Margherita Pizza",
      description: "Classic Neapolitan pizza with tomato, fresh mozzarella, and basil",
      prep_time: 30, cook_time: 15, total_time: 45, servings: 2, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 280, protein_g: 12, carbs_g: 36, fat_g: 10, fiber_g: 2, sodium_mg: 520,
      ingredients: [
        { name: "Pizza dough", quantity: 1, unit: "ball", aisle: "Bakery" },
        { name: "San Marzano tomatoes", quantity: 1, unit: "can", aisle: "Canned Goods" },
        { name: "Fresh mozzarella", quantity: 8, unit: "oz", aisle: "Dairy" }
      ],
      steps: ["Stretch dough into circle.", "Top with crushed tomatoes and torn mozzarella.", "Bake at high heat, finish with fresh basil."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Authentic Margherita pizza fresh from oven with bubbling mozzarella, fresh basil leaves, charred crust, food photography"
    },
    {
      title: "Chicken Parmigiana",
      description: "Breaded chicken cutlet topped with marinara and melted mozzarella",
      prep_time: 20, cook_time: 25, total_time: 45, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 42, carbs_g: 28, fat_g: 22, fiber_g: 3, sodium_mg: 820,
      ingredients: [
        { name: "Chicken breasts", quantity: 4, unit: "pieces", aisle: "Meat" },
        { name: "Marinara sauce", quantity: 2, unit: "cups", aisle: "Canned Goods" },
        { name: "Mozzarella", quantity: 2, unit: "cups", aisle: "Dairy" }
      ],
      steps: ["Bread and fry chicken cutlets.", "Top with marinara and cheese.", "Bake until cheese is bubbly."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Chicken parmigiana with melted mozzarella and marinara sauce over pasta, Italian-American classic, food photography"
    },
    {
      title: "Risotto ai Funghi",
      description: "Creamy mushroom risotto with arborio rice and parmesan",
      prep_time: 10, cook_time: 35, total_time: 45, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 380, protein_g: 10, carbs_g: 52, fat_g: 14, fiber_g: 2, sodium_mg: 480,
      ingredients: [
        { name: "Arborio rice", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Mixed mushrooms", quantity: 12, unit: "oz", aisle: "Produce" },
        { name: "Vegetable broth", quantity: 6, unit: "cups", aisle: "Canned Goods" }
      ],
      steps: ["Sauté mushrooms and set aside.", "Toast rice, add broth gradually.", "Finish with butter, parmesan, and mushrooms."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Creamy mushroom risotto in white bowl with sautéed porcini mushrooms, fresh parsley, parmesan shavings, food photography"
    },
    {
      title: "Bruschetta",
      description: "Toasted bread topped with fresh tomatoes, basil, and garlic",
      prep_time: 15, cook_time: 5, total_time: 20, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 24, fat_g: 8, fiber_g: 2, sodium_mg: 320,
      ingredients: [
        { name: "Baguette", quantity: 1, unit: "loaf", aisle: "Bakery" },
        { name: "Roma tomatoes", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "Fresh basil", quantity: 0.25, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Toast baguette slices.", "Mix diced tomatoes with basil, garlic, olive oil.", "Top bread with tomato mixture."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Fresh bruschetta on toasted bread with diced tomatoes, basil, olive oil drizzle, Italian appetizer, food photography"
    },
    {
      title: "Lasagna Bolognese",
      description: "Layered pasta with rich meat sauce, béchamel, and cheese",
      prep_time: 45, cook_time: 60, total_time: 105, servings: 8, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 580, protein_g: 32, carbs_g: 48, fat_g: 28, fiber_g: 4, sodium_mg: 920,
      ingredients: [
        { name: "Lasagna sheets", quantity: 12, unit: "sheets", aisle: "Pasta" },
        { name: "Ground beef", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Ricotta cheese", quantity: 2, unit: "cups", aisle: "Dairy" }
      ],
      steps: ["Make bolognese sauce with beef.", "Layer pasta, meat sauce, ricotta, mozzarella.", "Bake until bubbly and golden."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Slice of layered lasagna bolognese with meat sauce, melted cheese, fresh basil on top, comfort food, food photography"
    },
    {
      title: "Minestrone Soup",
      description: "Hearty Italian vegetable soup with beans and pasta",
      prep_time: 15, cook_time: 40, total_time: 55, servings: 6, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 10, carbs_g: 38, fat_g: 4, fiber_g: 8, sodium_mg: 580,
      ingredients: [
        { name: "Cannellini beans", quantity: 1, unit: "can", aisle: "Canned Goods" },
        { name: "Ditalini pasta", quantity: 1, unit: "cup", aisle: "Pasta" },
        { name: "Mixed vegetables", quantity: 4, unit: "cups", aisle: "Produce" }
      ],
      steps: ["Sauté onion, celery, carrots.", "Add broth, tomatoes, beans, simmer.", "Add pasta, cook until tender."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Bowl of minestrone soup with vegetables, white beans, small pasta, drizzle of olive oil, rustic Italian, food photography"
    },
    {
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone",
      prep_time: 30, cook_time: 0, total_time: 30, servings: 8, difficulty: "medium",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 320, protein_g: 6, carbs_g: 32, fat_g: 18, fiber_g: 0, sodium_mg: 80,
      ingredients: [
        { name: "Ladyfingers", quantity: 24, unit: "pieces", aisle: "Bakery" },
        { name: "Mascarpone", quantity: 16, unit: "oz", aisle: "Dairy" },
        { name: "Espresso", quantity: 1, unit: "cup", aisle: "Beverages" }
      ],
      steps: ["Make mascarpone cream with eggs.", "Dip ladyfingers in espresso.", "Layer and refrigerate overnight."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Elegant tiramisu slice showing layers, dusted with cocoa powder, Italian dessert, food photography"
    }
  ],
  Mexican: [
    {
      title: "Chicken Enchiladas",
      description: "Corn tortillas filled with chicken, rolled and topped with red sauce",
      prep_time: 25, cook_time: 25, total_time: 50, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 28, carbs_g: 32, fat_g: 20, fiber_g: 4, sodium_mg: 720,
      ingredients: [
        { name: "Corn tortillas", quantity: 12, unit: "tortillas", aisle: "Mexican" },
        { name: "Shredded chicken", quantity: 3, unit: "cups", aisle: "Meat" },
        { name: "Enchilada sauce", quantity: 2, unit: "cups", aisle: "Mexican" }
      ],
      steps: ["Fill tortillas with chicken and roll.", "Place in baking dish, cover with sauce.", "Top with cheese and bake."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Red enchiladas in baking dish with melted cheese, sour cream, cilantro, Mexican cuisine, food photography"
    },
    {
      title: "Guacamole",
      description: "Fresh avocado dip with lime, cilantro, and jalapeño",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 160, protein_g: 2, carbs_g: 10, fat_g: 14, fiber_g: 6, sodium_mg: 180,
      ingredients: [
        { name: "Avocados", quantity: 3, unit: "ripe", aisle: "Produce" },
        { name: "Lime", quantity: 1, unit: "whole", aisle: "Produce" },
        { name: "Cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Mash avocados to desired consistency.", "Add lime juice, cilantro, onion, jalapeño.", "Season with salt and serve."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Fresh chunky guacamole in molcajete with tortilla chips, lime wedges, cilantro, Mexican appetizer, food photography"
    },
    {
      title: "Carnitas",
      description: "Slow-braised pork shoulder with citrus and spices",
      prep_time: 20, cook_time: 180, total_time: 200, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 35, carbs_g: 4, fat_g: 24, fiber_g: 0, sodium_mg: 520,
      ingredients: [
        { name: "Pork shoulder", quantity: 4, unit: "lbs", aisle: "Meat" },
        { name: "Orange", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Cumin", quantity: 1, unit: "tbsp", aisle: "Spices" }
      ],
      steps: ["Season pork with spices.", "Slow cook with orange juice 3 hours.", "Shred and crisp under broiler."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Crispy carnitas pork on cutting board with cilantro, lime wedges, corn tortillas, Mexican street food, food photography"
    },
    {
      title: "Chicken Quesadilla",
      description: "Crispy flour tortilla filled with chicken and melted cheese",
      prep_time: 10, cook_time: 10, total_time: 20, servings: 2, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 32, carbs_g: 36, fat_g: 24, fiber_g: 2, sodium_mg: 680,
      ingredients: [
        { name: "Flour tortillas", quantity: 2, unit: "large", aisle: "Mexican" },
        { name: "Grilled chicken", quantity: 1, unit: "cup", aisle: "Meat" },
        { name: "Mexican cheese blend", quantity: 1, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Place chicken and cheese on half of tortilla.", "Fold and cook until golden on both sides.", "Cut into wedges and serve."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "quick", tag_value: "under-30" }],
      image_prompt: "Golden chicken quesadilla cut into triangles with sour cream, guacamole, salsa, Mexican food, food photography"
    },
    {
      title: "Fish Tacos",
      description: "Beer-battered fish with cabbage slaw and chipotle crema",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 380, protein_g: 24, carbs_g: 32, fat_g: 18, fiber_g: 4, sodium_mg: 520,
      ingredients: [
        { name: "White fish fillets", quantity: 1, unit: "lb", aisle: "Seafood" },
        { name: "Corn tortillas", quantity: 8, unit: "small", aisle: "Mexican" },
        { name: "Cabbage", quantity: 2, unit: "cups", aisle: "Produce" }
      ],
      steps: ["Batter and fry fish pieces.", "Warm tortillas.", "Assemble with slaw and crema."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "fish" }],
      image_prompt: "Baja fish tacos on corn tortillas with purple cabbage slaw, chipotle crema, lime, Mexican street food, food photography"
    },
    {
      title: "Burrito Bowl",
      description: "Deconstructed burrito with rice, beans, protein, and toppings",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 520, protein_g: 28, carbs_g: 58, fat_g: 18, fiber_g: 12, sodium_mg: 680,
      ingredients: [
        { name: "Cilantro lime rice", quantity: 2, unit: "cups", aisle: "Grains" },
        { name: "Black beans", quantity: 1, unit: "can", aisle: "Canned Goods" },
        { name: "Grilled chicken", quantity: 1, unit: "lb", aisle: "Meat" }
      ],
      steps: ["Cook rice with lime and cilantro.", "Grill and slice chicken.", "Assemble bowls with all toppings."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "mealprep", tag_value: "true" }],
      image_prompt: "Colorful burrito bowl with rice, black beans, grilled chicken, corn, guacamole, salsa, Mexican food, food photography"
    },
    {
      title: "Churros",
      description: "Fried dough pastry coated in cinnamon sugar",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 280, protein_g: 4, carbs_g: 38, fat_g: 14, fiber_g: 1, sodium_mg: 180,
      ingredients: [
        { name: "Flour", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Sugar", quantity: 0.5, unit: "cup", aisle: "Baking" },
        { name: "Cinnamon", quantity: 2, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Make choux dough.", "Pipe and fry until golden.", "Coat in cinnamon sugar."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Golden churros coated in cinnamon sugar with chocolate dipping sauce, Mexican dessert, food photography"
    },
    {
      title: "Pozole Rojo",
      description: "Traditional Mexican pork and hominy soup with red chile",
      prep_time: 30, cook_time: 120, total_time: 150, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 28, carbs_g: 24, fat_g: 16, fiber_g: 4, sodium_mg: 680,
      ingredients: [
        { name: "Pork shoulder", quantity: 2, unit: "lbs", aisle: "Meat" },
        { name: "Hominy", quantity: 2, unit: "cans", aisle: "Mexican" },
        { name: "Dried guajillo chiles", quantity: 6, unit: "whole", aisle: "Mexican" }
      ],
      steps: ["Simmer pork until tender.", "Blend chiles into sauce.", "Combine with hominy and shredded pork."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Bowl of pozole rojo with shredded pork, hominy, garnished with cabbage, radish, oregano, Mexican soup, food photography"
    }
  ],
  Asian: [
    {
      title: "Chicken Fried Rice",
      description: "Wok-fried rice with vegetables, egg, and tender chicken pieces",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 24, carbs_g: 48, fat_g: 14, fiber_g: 3, sodium_mg: 720,
      ingredients: [
        { name: "Day-old rice", quantity: 4, unit: "cups", aisle: "Grains" },
        { name: "Chicken breast", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Eggs", quantity: 3, unit: "large", aisle: "Dairy" }
      ],
      steps: ["Cook chicken and set aside.", "Scramble eggs in hot wok.", "Add rice and chicken, stir-fry with soy sauce."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "quick", tag_value: "under-30" }],
      image_prompt: "Wok-fried chicken fried rice with scrambled eggs, green onions, peas, Asian cuisine, food photography"
    },
    {
      title: "Beef and Broccoli",
      description: "Tender beef strips with broccoli in savory garlic sauce",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 32, carbs_g: 18, fat_g: 20, fiber_g: 4, sodium_mg: 780,
      ingredients: [
        { name: "Flank steak", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Broccoli florets", quantity: 4, unit: "cups", aisle: "Produce" },
        { name: "Soy sauce", quantity: 0.25, unit: "cup", aisle: "Asian" }
      ],
      steps: ["Slice beef thin against the grain.", "Stir-fry beef until browned.", "Add broccoli and sauce, cook until tender."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Beef and broccoli stir-fry in glossy brown sauce, white rice on side, Chinese takeout style, food photography"
    },
    {
      title: "Vegetable Spring Rolls",
      description: "Crispy fried rolls filled with cabbage and vegetables",
      prep_time: 30, cook_time: 15, total_time: 45, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 24, fat_g: 8, fiber_g: 2, sodium_mg: 320,
      ingredients: [
        { name: "Spring roll wrappers", quantity: 20, unit: "sheets", aisle: "Asian" },
        { name: "Cabbage", quantity: 4, unit: "cups", aisle: "Produce" },
        { name: "Carrots", quantity: 2, unit: "medium", aisle: "Produce" }
      ],
      steps: ["Sauté vegetables until tender.", "Wrap in spring roll wrappers.", "Deep fry until golden."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Crispy golden spring rolls cut in half showing vegetable filling, sweet chili dipping sauce, Asian appetizer, food photography"
    },
    {
      title: "Kung Pao Chicken",
      description: "Spicy Sichuan chicken with peanuts and dried chilies",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 32, carbs_g: 22, fat_g: 24, fiber_g: 3, sodium_mg: 820,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Roasted peanuts", quantity: 0.5, unit: "cup", aisle: "Snacks" },
        { name: "Dried red chilies", quantity: 10, unit: "whole", aisle: "Asian" }
      ],
      steps: ["Cube and marinate chicken.", "Stir-fry with chilies and Sichuan peppercorns.", "Add sauce and peanuts."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Kung Pao chicken with peanuts, dried red chilies, scallions, Sichuan Chinese cuisine, food photography"
    },
    {
      title: "Miso Soup",
      description: "Traditional Japanese soup with tofu, seaweed, and green onions",
      prep_time: 5, cook_time: 10, total_time: 15, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 80, protein_g: 6, carbs_g: 8, fat_g: 3, fiber_g: 1, sodium_mg: 620,
      ingredients: [
        { name: "White miso paste", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Silken tofu", quantity: 8, unit: "oz", aisle: "Produce" },
        { name: "Wakame seaweed", quantity: 2, unit: "tbsp", aisle: "Asian" }
      ],
      steps: ["Heat dashi broth.", "Dissolve miso paste.", "Add tofu and seaweed, garnish with scallions."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Bowl of miso soup with tofu cubes, wakame seaweed, green onions, Japanese cuisine, food photography"
    },
    {
      title: "Pad See Ew",
      description: "Thai stir-fried wide rice noodles with Chinese broccoli",
      prep_time: 15, cook_time: 10, total_time: 25, servings: 2, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 480, protein_g: 22, carbs_g: 62, fat_g: 16, fiber_g: 3, sodium_mg: 920,
      ingredients: [
        { name: "Wide rice noodles", quantity: 8, unit: "oz", aisle: "Asian" },
        { name: "Chinese broccoli", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Chicken or tofu", quantity: 8, unit: "oz", aisle: "Meat" }
      ],
      steps: ["Soak noodles until pliable.", "Stir-fry protein and vegetables.", "Add noodles with sauce, char slightly."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "quick", tag_value: "under-30" }],
      image_prompt: "Pad See Ew Thai noodles with Chinese broccoli, egg, dark soy sauce char, Thai street food, food photography"
    },
    {
      title: "General Tso's Chicken",
      description: "Crispy fried chicken in sweet and spicy sauce",
      prep_time: 25, cook_time: 20, total_time: 45, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 520, protein_g: 28, carbs_g: 42, fat_g: 26, fiber_g: 2, sodium_mg: 980,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Cornstarch", quantity: 0.5, unit: "cup", aisle: "Baking" },
        { name: "Hoisin sauce", quantity: 0.25, unit: "cup", aisle: "Asian" }
      ],
      steps: ["Cut and coat chicken in cornstarch.", "Deep fry until crispy.", "Toss in sweet and spicy sauce."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "General Tso's chicken with crispy coating, glossy sauce, dried chilies, broccoli, steamed rice, food photography"
    },
    {
      title: "Vietnamese Pho",
      description: "Aromatic beef noodle soup with herbs and bean sprouts",
      prep_time: 20, cook_time: 180, total_time: 200, servings: 6, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 32, carbs_g: 48, fat_g: 12, fiber_g: 2, sodium_mg: 1200,
      ingredients: [
        { name: "Beef bones", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "Rice noodles", quantity: 1, unit: "lb", aisle: "Asian" },
        { name: "Beef sirloin", quantity: 1, unit: "lb", aisle: "Meat" }
      ],
      steps: ["Simmer bones for rich broth.", "Toast spices and add to broth.", "Serve over noodles with fresh herbs."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Bowl of Vietnamese pho with rare beef slices, rice noodles, fresh herbs, bean sprouts, lime, food photography"
    }
  ],
  Mediterranean: [
    {
      title: "Greek Salad",
      description: "Fresh cucumber, tomatoes, olives, and feta with olive oil",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 6, carbs_g: 12, fat_g: 18, fiber_g: 3, sodium_mg: 480,
      ingredients: [
        { name: "Cucumber", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Tomatoes", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Feta cheese", quantity: 6, unit: "oz", aisle: "Dairy" }
      ],
      steps: ["Chop vegetables into chunks.", "Add olives and feta.", "Dress with olive oil and oregano."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Fresh Greek salad with chunky feta cheese, kalamata olives, cucumber, tomatoes, olive oil, food photography"
    },
    {
      title: "Falafel",
      description: "Crispy fried chickpea fritters with herbs and spices",
      prep_time: 30, cook_time: 15, total_time: 45, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 12, carbs_g: 32, fat_g: 12, fiber_g: 8, sodium_mg: 380,
      ingredients: [
        { name: "Dried chickpeas", quantity: 1, unit: "lb", aisle: "Grains" },
        { name: "Fresh parsley", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Cumin", quantity: 2, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Soak chickpeas overnight.", "Blend with herbs and spices.", "Form into balls and fry until golden."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Golden crispy falafel balls on plate with tahini sauce, pickled vegetables, pita bread, Mediterranean food, food photography"
    },
    {
      title: "Shakshuka",
      description: "Eggs poached in spiced tomato and pepper sauce",
      prep_time: 10, cook_time: 25, total_time: 35, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 280, protein_g: 14, carbs_g: 18, fat_g: 18, fiber_g: 4, sodium_mg: 520,
      ingredients: [
        { name: "Eggs", quantity: 6, unit: "large", aisle: "Dairy" },
        { name: "Crushed tomatoes", quantity: 28, unit: "oz", aisle: "Canned Goods" },
        { name: "Bell peppers", quantity: 2, unit: "medium", aisle: "Produce" }
      ],
      steps: ["Sauté peppers and onions.", "Add tomatoes and spices, simmer.", "Create wells and poach eggs."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Shakshuka in cast iron skillet with poached eggs in tomato sauce, crusty bread, fresh herbs, food photography"
    },
    {
      title: "Lamb Kofta",
      description: "Grilled spiced lamb skewers with yogurt sauce",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 380, protein_g: 28, carbs_g: 8, fat_g: 26, fiber_g: 1, sodium_mg: 480,
      ingredients: [
        { name: "Ground lamb", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Cumin", quantity: 1, unit: "tbsp", aisle: "Spices" },
        { name: "Fresh mint", quantity: 0.25, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Mix lamb with spices and herbs.", "Form onto skewers.", "Grill until charred and cooked through."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "lamb" }],
      image_prompt: "Grilled lamb kofta skewers with tzatziki sauce, grilled pita, fresh herbs, Mediterranean cuisine, food photography"
    },
    {
      title: "Tabbouleh",
      description: "Fresh herb and bulgur salad with lemon and tomatoes",
      prep_time: 20, cook_time: 0, total_time: 20, servings: 6, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 160, protein_g: 4, carbs_g: 24, fat_g: 6, fiber_g: 5, sodium_mg: 180,
      ingredients: [
        { name: "Bulgur wheat", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Fresh parsley", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Fresh mint", quantity: 0.5, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Soak bulgur until tender.", "Finely chop herbs and tomatoes.", "Mix all with lemon juice and olive oil."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Fresh tabbouleh salad with bright green parsley, bulgur, diced tomatoes, lemon, Lebanese cuisine, food photography"
    },
    {
      title: "Baba Ganoush",
      description: "Smoky roasted eggplant dip with tahini and garlic",
      prep_time: 15, cook_time: 40, total_time: 55, servings: 6, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 120, protein_g: 3, carbs_g: 10, fat_g: 8, fiber_g: 4, sodium_mg: 180,
      ingredients: [
        { name: "Eggplant", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Tahini", quantity: 0.25, unit: "cup", aisle: "International" },
        { name: "Garlic", quantity: 2, unit: "cloves", aisle: "Produce" }
      ],
      steps: ["Char eggplants over flame or roast.", "Scoop flesh and mash.", "Mix with tahini, lemon, and garlic."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Smoky baba ganoush in bowl with olive oil drizzle, pomegranate seeds, pita chips, Middle Eastern dip, food photography"
    },
    {
      title: "Moussaka",
      description: "Layered eggplant and meat casserole with béchamel",
      prep_time: 45, cook_time: 60, total_time: 105, servings: 8, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 22, carbs_g: 28, fat_g: 26, fiber_g: 5, sodium_mg: 680,
      ingredients: [
        { name: "Eggplant", quantity: 3, unit: "large", aisle: "Produce" },
        { name: "Ground lamb", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Potatoes", quantity: 2, unit: "large", aisle: "Produce" }
      ],
      steps: ["Slice and salt eggplant, then fry.", "Make meat sauce with tomatoes.", "Layer and top with béchamel, bake."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "lamb" }],
      image_prompt: "Slice of Greek moussaka showing layers of eggplant, meat sauce, golden béchamel top, comfort food, food photography"
    },
    {
      title: "Stuffed Grape Leaves",
      description: "Tender grape leaves filled with herbed rice",
      prep_time: 45, cook_time: 45, total_time: 90, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 160, protein_g: 3, carbs_g: 28, fat_g: 5, fiber_g: 2, sodium_mg: 320,
      ingredients: [
        { name: "Grape leaves", quantity: 1, unit: "jar", aisle: "International" },
        { name: "Long grain rice", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Fresh dill", quantity: 0.5, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Prepare rice filling with herbs.", "Roll in grape leaves.", "Simmer in lemon water until tender."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Dolmades stuffed grape leaves arranged on plate with lemon wedges, yogurt dip, Greek mezze, food photography"
    }
  ],
  Indian: [
    {
      title: "Butter Chicken",
      description: "Creamy tomato curry with tender tandoori chicken pieces",
      prep_time: 30, cook_time: 30, total_time: 60, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 32, carbs_g: 18, fat_g: 32, fiber_g: 3, sodium_mg: 720,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Heavy cream", quantity: 1, unit: "cup", aisle: "Dairy" },
        { name: "Tomato puree", quantity: 14, unit: "oz", aisle: "Canned Goods" }
      ],
      steps: ["Marinate and grill chicken.", "Make creamy tomato sauce.", "Combine and simmer."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Butter chicken murgh makhani in creamy orange tomato sauce, fresh cilantro, naan bread, Indian cuisine, food photography"
    },
    {
      title: "Chana Masala",
      description: "Spiced chickpea curry with tomatoes and onions",
      prep_time: 15, cook_time: 30, total_time: 45, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 12, carbs_g: 42, fat_g: 8, fiber_g: 10, sodium_mg: 520,
      ingredients: [
        { name: "Chickpeas", quantity: 2, unit: "cans", aisle: "Canned Goods" },
        { name: "Onion", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Garam masala", quantity: 2, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Sauté onions with spices.", "Add tomatoes and chickpeas.", "Simmer until thick."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Chana masala chickpea curry in bowl with basmati rice, fresh cilantro, Indian vegetarian cuisine, food photography"
    },
    {
      title: "Tandoori Chicken",
      description: "Yogurt-marinated chicken roasted with aromatic spices",
      prep_time: 20, cook_time: 35, total_time: 55, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 38, carbs_g: 6, fat_g: 16, fiber_g: 1, sodium_mg: 580,
      ingredients: [
        { name: "Chicken legs", quantity: 8, unit: "pieces", aisle: "Meat" },
        { name: "Yogurt", quantity: 1, unit: "cup", aisle: "Dairy" },
        { name: "Tandoori spice blend", quantity: 3, unit: "tbsp", aisle: "Spices" }
      ],
      steps: ["Score chicken and marinate overnight.", "Roast at high heat until charred.", "Serve with lemon and onions."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Red tandoori chicken with char marks, lemon wedges, sliced onions, mint chutney, Indian cuisine, food photography"
    },
    {
      title: "Palak Paneer",
      description: "Creamy spinach curry with cubes of Indian cheese",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 18, carbs_g: 12, fat_g: 24, fiber_g: 4, sodium_mg: 480,
      ingredients: [
        { name: "Fresh spinach", quantity: 1, unit: "lb", aisle: "Produce" },
        { name: "Paneer", quantity: 14, unit: "oz", aisle: "Dairy" },
        { name: "Cream", quantity: 0.25, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Blanch and puree spinach.", "Fry paneer cubes until golden.", "Combine in spiced cream sauce."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Palak paneer with golden paneer cubes in bright green spinach sauce, cream swirl, naan, Indian food, food photography"
    },
    {
      title: "Samosas",
      description: "Crispy pastry triangles filled with spiced potatoes and peas",
      prep_time: 45, cook_time: 20, total_time: 65, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 5, carbs_g: 32, fat_g: 9, fiber_g: 3, sodium_mg: 380,
      ingredients: [
        { name: "Potatoes", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Peas", quantity: 1, unit: "cup", aisle: "Frozen" },
        { name: "Pastry dough", quantity: 1, unit: "lb", aisle: "Refrigerated" }
      ],
      steps: ["Make spiced potato filling.", "Wrap in triangular pastry.", "Deep fry until golden."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Golden crispy samosas on plate with green mint chutney and tamarind sauce, Indian street food, food photography"
    },
    {
      title: "Dal Tadka",
      description: "Comfort yellow lentils with tempered spices and ghee",
      prep_time: 10, cook_time: 30, total_time: 40, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 240, protein_g: 14, carbs_g: 36, fat_g: 6, fiber_g: 12, sodium_mg: 320,
      ingredients: [
        { name: "Yellow lentils", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Ghee", quantity: 2, unit: "tbsp", aisle: "Dairy" },
        { name: "Cumin seeds", quantity: 1, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Cook lentils until soft.", "Make tadka with ghee and spices.", "Pour over lentils and serve."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Dal tadka yellow lentils with ghee tadka, fresh cilantro, served with rice, Indian comfort food, food photography"
    },
    {
      title: "Chicken Tikka Masala",
      description: "Grilled chicken chunks in creamy spiced tomato sauce",
      prep_time: 25, cook_time: 35, total_time: 60, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 420, protein_g: 34, carbs_g: 16, fat_g: 24, fiber_g: 3, sodium_mg: 680,
      ingredients: [
        { name: "Chicken breast", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Tikka masala sauce", quantity: 15, unit: "oz", aisle: "International" },
        { name: "Yogurt", quantity: 0.5, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Marinate and grill chicken tikka.", "Simmer in creamy masala sauce.", "Garnish with cream and cilantro."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Chicken tikka masala with grilled chicken pieces in orange creamy sauce, basmati rice, naan, Indian food, food photography"
    },
    {
      title: "Biryani",
      description: "Fragrant layered rice with spiced chicken, saffron, and aromatic whole spices",
      prep_time: 40, cook_time: 60, total_time: 100, servings: 6, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 480, protein_g: 26, carbs_g: 52, fat_g: 18, fiber_g: 3, sodium_mg: 450,
      ingredients: [
        { name: "Basmati rice", quantity: 2, unit: "cups", aisle: "Grains" },
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Plain yogurt", quantity: 0.5, unit: "cup", aisle: "Dairy" },
        { name: "Saffron threads", quantity: 0.5, unit: "tsp", aisle: "Spices" },
        { name: "Garam masala", quantity: 1, unit: "tbsp", aisle: "Spices" },
        { name: "Fresh ginger", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" },
        { name: "Onions", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Fresh mint", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Fresh cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Ghee", quantity: 3, unit: "tbsp", aisle: "Dairy" }
      ],
      steps: [
        "Marinate chicken in yogurt, garam masala, ginger, and garlic for at least 30 minutes.",
        "Parboil rice with whole spices (bay leaves, cardamom, cinnamon) until 70% cooked, drain.",
        "Caramelize sliced onions in ghee until deep golden brown.",
        "Layer marinated chicken, then rice, then fried onions, mint, and cilantro.",
        "Drizzle saffron soaked in warm milk over the top.",
        "Cover tightly and dum cook on low heat for 25-30 minutes."
      ],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }, { tag_type: "cuisine", tag_value: "indian" }],
      image_prompt: "Hyderabadi chicken biryani with saffron rice, tender meat, caramelized fried onions, fresh mint and cilantro, served in copper handi, Indian feast, food photography"
    }
  ],
  Japanese: [
    {
      title: "Chicken Katsu",
      description: "Crispy breaded chicken cutlet with tonkatsu sauce",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 2, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 38, carbs_g: 32, fat_g: 22, fiber_g: 2, sodium_mg: 720,
      ingredients: [
        { name: "Chicken breast", quantity: 2, unit: "pieces", aisle: "Meat" },
        { name: "Panko breadcrumbs", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Tonkatsu sauce", quantity: 0.25, unit: "cup", aisle: "Asian" }
      ],
      steps: ["Pound chicken thin.", "Coat in flour, egg, and panko.", "Fry until golden and cooked through."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Chicken katsu sliced showing juicy interior, shredded cabbage, tonkatsu sauce, steamed rice, Japanese food, food photography"
    },
    {
      title: "Ramen",
      description: "Rich pork broth noodle soup with soft egg and chashu",
      prep_time: 30, cook_time: 240, total_time: 270, servings: 4, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 580, protein_g: 32, carbs_g: 62, fat_g: 24, fiber_g: 3, sodium_mg: 1400,
      ingredients: [
        { name: "Pork bones", quantity: 2, unit: "lbs", aisle: "Meat" },
        { name: "Ramen noodles", quantity: 4, unit: "portions", aisle: "Asian" },
        { name: "Soft boiled eggs", quantity: 4, unit: "eggs", aisle: "Dairy" }
      ],
      steps: ["Simmer bones for rich broth.", "Prepare chashu pork belly.", "Assemble with noodles and toppings."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Bowl of tonkotsu ramen with chashu pork, soft boiled egg, nori, green onions, rich creamy broth, Japanese cuisine, food photography"
    },
    {
      title: "Gyoza",
      description: "Pan-fried pork and cabbage dumplings",
      prep_time: 40, cook_time: 15, total_time: 55, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 14, carbs_g: 32, fat_g: 12, fiber_g: 2, sodium_mg: 580,
      ingredients: [
        { name: "Ground pork", quantity: 0.5, unit: "lb", aisle: "Meat" },
        { name: "Cabbage", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Gyoza wrappers", quantity: 30, unit: "pieces", aisle: "Asian" }
      ],
      steps: ["Mix filling with seasonings.", "Fold and pleat dumplings.", "Pan-fry until crispy and steamed through."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Pan-fried gyoza dumplings with crispy bottoms, dipping sauce with chili oil, Japanese appetizer, food photography"
    },
    {
      title: "Teriyaki Chicken",
      description: "Grilled chicken glazed with sweet soy teriyaki sauce",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 34, carbs_g: 24, fat_g: 14, fiber_g: 1, sodium_mg: 820,
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Soy sauce", quantity: 0.25, unit: "cup", aisle: "Asian" },
        { name: "Mirin", quantity: 0.25, unit: "cup", aisle: "Asian" }
      ],
      steps: ["Grill chicken until cooked.", "Glaze with teriyaki sauce.", "Serve with rice and vegetables."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Teriyaki chicken with glossy glaze, sesame seeds, steamed broccoli, white rice, Japanese cuisine, food photography"
    },
    {
      title: "Onigiri",
      description: "Japanese rice balls with savory fillings",
      prep_time: 20, cook_time: 0, total_time: 20, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 6, carbs_g: 36, fat_g: 2, fiber_g: 1, sodium_mg: 320,
      ingredients: [
        { name: "Sushi rice", quantity: 2, unit: "cups", aisle: "Grains" },
        { name: "Nori sheets", quantity: 4, unit: "sheets", aisle: "Asian" },
        { name: "Salmon flakes", quantity: 0.5, unit: "cup", aisle: "Seafood" }
      ],
      steps: ["Cook and season rice.", "Form triangles with filling inside.", "Wrap with nori strip."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "quick", tag_value: "under-30" }],
      image_prompt: "Japanese onigiri rice balls with nori wrapper, various fillings, bento style, Japanese snack food, food photography"
    },
    {
      title: "Tempura",
      description: "Light and crispy battered vegetables and shrimp",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 320, protein_g: 12, carbs_g: 28, fat_g: 18, fiber_g: 3, sodium_mg: 420,
      ingredients: [
        { name: "Shrimp", quantity: 12, unit: "large", aisle: "Seafood" },
        { name: "Sweet potato", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Tempura batter mix", quantity: 1, unit: "cup", aisle: "Asian" }
      ],
      steps: ["Make ice-cold tempura batter.", "Dip vegetables and shrimp.", "Fry until light and crispy."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "shrimp" }],
      image_prompt: "Crispy tempura with shrimp, vegetables, tentsuyu dipping sauce, grated daikon, Japanese cuisine, food photography"
    },
    {
      title: "Okonomiyaki",
      description: "Savory Japanese cabbage pancake with toppings",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 2, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 420, protein_g: 18, carbs_g: 42, fat_g: 20, fiber_g: 4, sodium_mg: 720,
      ingredients: [
        { name: "Cabbage", quantity: 4, unit: "cups", aisle: "Produce" },
        { name: "Flour", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" }
      ],
      steps: ["Mix batter with shredded cabbage.", "Cook as thick pancake.", "Top with sauce, mayo, bonito flakes."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Okonomiyaki Japanese pancake with okonomi sauce, mayo drizzle, bonito flakes, green onions, Japanese street food, food photography"
    },
    {
      title: "Mochi Ice Cream",
      description: "Soft rice cake filled with ice cream",
      prep_time: 30, cook_time: 5, total_time: 35, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 120, protein_g: 2, carbs_g: 22, fat_g: 3, fiber_g: 0, sodium_mg: 40,
      ingredients: [
        { name: "Mochi flour", quantity: 1, unit: "cup", aisle: "Asian" },
        { name: "Ice cream", quantity: 2, unit: "cups", aisle: "Frozen" },
        { name: "Sugar", quantity: 0.25, unit: "cup", aisle: "Baking" }
      ],
      steps: ["Make mochi dough.", "Wrap around ice cream balls.", "Freeze until firm."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Colorful mochi ice cream balls on plate, various flavors, soft chewy exterior, Japanese dessert, food photography"
    }
  ],
  Thai: [
    {
      title: "Pad Thai",
      description: "Stir-fried rice noodles with shrimp, peanuts, and tamarind",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 420, protein_g: 22, carbs_g: 52, fat_g: 14, fiber_g: 3, sodium_mg: 820,
      ingredients: [
        { name: "Rice noodles", quantity: 8, unit: "oz", aisle: "Asian" },
        { name: "Shrimp", quantity: 12, unit: "large", aisle: "Seafood" },
        { name: "Tamarind paste", quantity: 2, unit: "tbsp", aisle: "Asian" }
      ],
      steps: ["Soak noodles until pliable.", "Stir-fry shrimp and aromatics.", "Add noodles and sauce, toss with peanuts."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "shrimp" }],
      image_prompt: "Pad Thai rice noodles with shrimp, crushed peanuts, lime wedge, bean sprouts, Thai street food, food photography"
    },
    {
      title: "Green Curry",
      description: "Creamy coconut curry with Thai basil and vegetables",
      prep_time: 15, cook_time: 25, total_time: 40, servings: 4, difficulty: "easy",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 24, carbs_g: 18, fat_g: 26, fiber_g: 3, sodium_mg: 780,
      ingredients: [
        { name: "Green curry paste", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Coconut milk", quantity: 14, unit: "oz", aisle: "Asian" },
        { name: "Chicken breast", quantity: 1, unit: "lb", aisle: "Meat" }
      ],
      steps: ["Fry curry paste until fragrant.", "Add coconut milk and chicken.", "Simmer with vegetables and Thai basil."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Thai green curry in bowl with chicken, Thai eggplant, Thai basil, jasmine rice, Thai cuisine, food photography"
    },
    {
      title: "Tom Yum Soup",
      description: "Hot and sour Thai soup with shrimp and mushrooms",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "medium",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 18, carbs_g: 12, fat_g: 6, fiber_g: 2, sodium_mg: 920,
      ingredients: [
        { name: "Shrimp", quantity: 1, unit: "lb", aisle: "Seafood" },
        { name: "Lemongrass", quantity: 3, unit: "stalks", aisle: "Produce" },
        { name: "Mushrooms", quantity: 8, unit: "oz", aisle: "Produce" }
      ],
      steps: ["Simmer broth with aromatics.", "Add shrimp and mushrooms.", "Season with lime and fish sauce."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "shrimp" }],
      image_prompt: "Tom Yum Goong soup with shrimp, mushrooms, lemongrass, Thai chilies, lime leaves, Thai cuisine, food photography"
    },
    {
      title: "Massaman Curry",
      description: "Rich and mild curry with potatoes and peanuts",
      prep_time: 20, cook_time: 45, total_time: 65, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 28, carbs_g: 32, fat_g: 28, fiber_g: 4, sodium_mg: 680,
      ingredients: [
        { name: "Massaman curry paste", quantity: 3, unit: "tbsp", aisle: "Asian" },
        { name: "Beef chuck", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Potatoes", quantity: 2, unit: "medium", aisle: "Produce" }
      ],
      steps: ["Brown beef and set aside.", "Fry paste with coconut cream.", "Simmer with beef and potatoes until tender."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Massaman curry with beef chunks, potatoes, peanuts, coconut sauce, jasmine rice, Thai cuisine, food photography"
    },
    {
      title: "Thai Basil Chicken",
      description: "Spicy stir-fried chicken with holy basil",
      prep_time: 15, cook_time: 10, total_time: 25, servings: 2, difficulty: "easy",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 32, carbs_g: 12, fat_g: 22, fiber_g: 2, sodium_mg: 920,
      ingredients: [
        { name: "Ground chicken", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Thai basil", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Thai chilies", quantity: 4, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Fry garlic and chilies.", "Add chicken and stir-fry.", "Finish with Thai basil and sauce."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "quick", tag_value: "under-30" }],
      image_prompt: "Pad Krapow Gai Thai basil chicken with fried egg on top, jasmine rice, Thai street food, food photography"
    },
    {
      title: "Spring Rolls (Fresh)",
      description: "Fresh rice paper rolls with shrimp and vegetables",
      prep_time: 30, cook_time: 0, total_time: 30, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 12, carbs_g: 28, fat_g: 2, fiber_g: 3, sodium_mg: 380,
      ingredients: [
        { name: "Rice paper", quantity: 12, unit: "sheets", aisle: "Asian" },
        { name: "Cooked shrimp", quantity: 24, unit: "pieces", aisle: "Seafood" },
        { name: "Rice vermicelli", quantity: 4, unit: "oz", aisle: "Asian" }
      ],
      steps: ["Soften rice paper in water.", "Layer with vegetables, herbs, shrimp.", "Roll tightly and serve with sauce."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "gluten-free" }],
      image_prompt: "Fresh Vietnamese spring rolls with shrimp visible through rice paper, peanut dipping sauce, fresh herbs, food photography"
    },
    {
      title: "Mango Sticky Rice",
      description: "Sweet coconut sticky rice with fresh mango",
      prep_time: 20, cook_time: 30, total_time: 50, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 320, protein_g: 4, carbs_g: 62, fat_g: 8, fiber_g: 2, sodium_mg: 80,
      ingredients: [
        { name: "Sticky rice", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Coconut milk", quantity: 1, unit: "cup", aisle: "Asian" },
        { name: "Ripe mango", quantity: 2, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Soak and steam sticky rice.", "Mix with sweetened coconut milk.", "Serve with sliced mango."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Thai mango sticky rice with sliced ripe mango, coconut cream drizzle, sesame seeds, Thai dessert, food photography"
    },
    {
      title: "Larb",
      description: "Spicy Thai minced meat salad with herbs and lime",
      prep_time: 15, cook_time: 10, total_time: 25, servings: 4, difficulty: "easy",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 26, carbs_g: 8, fat_g: 16, fiber_g: 2, sodium_mg: 680,
      ingredients: [
        { name: "Ground chicken", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Shallots", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Fresh mint", quantity: 0.5, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Cook meat with lime juice.", "Add fish sauce and toasted rice powder.", "Toss with herbs and shallots."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Larb Thai minced chicken salad with fresh herbs, lime wedge, lettuce cups, Thai cuisine, food photography"
    }
  ],
  French: [
    {
      title: "Croque Monsieur",
      description: "Classic French ham and cheese sandwich with béchamel",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 2, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 520, protein_g: 26, carbs_g: 38, fat_g: 30, fiber_g: 2, sodium_mg: 980,
      ingredients: [
        { name: "Brioche bread", quantity: 4, unit: "slices", aisle: "Bakery" },
        { name: "Ham", quantity: 4, unit: "slices", aisle: "Deli" },
        { name: "Gruyere cheese", quantity: 4, unit: "oz", aisle: "Dairy" }
      ],
      steps: ["Make béchamel sauce.", "Assemble sandwiches with ham and cheese.", "Top with sauce and bake until golden."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Croque Monsieur French sandwich with melted gruyere, béchamel sauce, golden and bubbly, French bistro food, food photography"
    },
    {
      title: "French Onion Soup",
      description: "Caramelized onion soup with melted gruyere crouton",
      prep_time: 20, cook_time: 60, total_time: 80, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 12, carbs_g: 32, fat_g: 16, fiber_g: 3, sodium_mg: 920,
      ingredients: [
        { name: "Onions", quantity: 4, unit: "large", aisle: "Produce" },
        { name: "Beef broth", quantity: 6, unit: "cups", aisle: "Canned Goods" },
        { name: "Gruyere cheese", quantity: 6, unit: "oz", aisle: "Dairy" }
      ],
      steps: ["Caramelize onions slowly.", "Add broth and simmer.", "Top with bread and cheese, broil."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "French onion soup in crock with melted bubbly gruyere cheese on bread, caramelized onions visible, food photography"
    },
    {
      title: "Coq au Vin",
      description: "Braised chicken in red wine with mushrooms and bacon",
      prep_time: 30, cook_time: 90, total_time: 120, servings: 4, difficulty: "hard",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 520, protein_g: 38, carbs_g: 18, fat_g: 28, fiber_g: 3, sodium_mg: 780,
      ingredients: [
        { name: "Chicken pieces", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "Red wine", quantity: 2, unit: "cups", aisle: "Wine" },
        { name: "Mushrooms", quantity: 8, unit: "oz", aisle: "Produce" }
      ],
      steps: ["Brown chicken and set aside.", "Sauté vegetables and bacon.", "Braise in wine until tender."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Coq au Vin braised chicken in rich wine sauce with mushrooms, pearl onions, French cuisine, food photography"
    },
    {
      title: "Ratatouille",
      description: "Provençal vegetable stew with tomatoes and herbs",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 24, fat_g: 8, fiber_g: 6, sodium_mg: 380,
      ingredients: [
        { name: "Eggplant", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Zucchini", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Bell peppers", quantity: 2, unit: "medium", aisle: "Produce" }
      ],
      steps: ["Slice vegetables thinly.", "Layer in baking dish.", "Bake with tomato sauce and herbs."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }],
      image_prompt: "Beautiful tian-style ratatouille with sliced vegetables in spiral pattern, fresh herbs, Provençal cuisine, food photography"
    },
    {
      title: "Quiche Lorraine",
      description: "Savory custard tart with bacon and gruyere",
      prep_time: 25, cook_time: 45, total_time: 70, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 14, carbs_g: 22, fat_g: 26, fiber_g: 1, sodium_mg: 580,
      ingredients: [
        { name: "Pie crust", quantity: 1, unit: "9-inch", aisle: "Refrigerated" },
        { name: "Bacon", quantity: 6, unit: "slices", aisle: "Meat" },
        { name: "Heavy cream", quantity: 1, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Blind bake crust.", "Cook bacon and layer in crust.", "Pour custard and bake until set."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Slice of Quiche Lorraine showing creamy custard, bacon pieces, in buttery crust, French brunch, food photography"
    },
    {
      title: "Crêpes",
      description: "Thin French pancakes with sweet or savory fillings",
      prep_time: 15, cook_time: 20, total_time: 35, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 6, carbs_g: 28, fat_g: 10, fiber_g: 1, sodium_mg: 180,
      ingredients: [
        { name: "Flour", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Milk", quantity: 1.5, unit: "cups", aisle: "Dairy" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" }
      ],
      steps: ["Make thin batter.", "Cook thin pancakes in buttered pan.", "Fill with desired toppings."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "French crêpes folded with Nutella and strawberries, powdered sugar dusting, French breakfast, food photography"
    },
    {
      title: "Beef Bourguignon",
      description: "Slow-braised beef stew in red Burgundy wine",
      prep_time: 30, cook_time: 180, total_time: 210, servings: 6, difficulty: "hard",
      is_kid_friendly: false, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 36, carbs_g: 22, fat_g: 24, fiber_g: 4, sodium_mg: 680,
      ingredients: [
        { name: "Beef chuck", quantity: 3, unit: "lbs", aisle: "Meat" },
        { name: "Burgundy wine", quantity: 3, unit: "cups", aisle: "Wine" },
        { name: "Pearl onions", quantity: 1, unit: "bag", aisle: "Produce" }
      ],
      steps: ["Brown beef in batches.", "Deglaze with wine and broth.", "Braise until fork tender."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Beef Bourguignon stew with tender beef chunks, carrots, pearl onions, rich wine sauce, French cuisine, food photography"
    },
    {
      title: "Croissants",
      description: "Buttery, flaky French pastry crescents",
      prep_time: 120, cook_time: 20, total_time: 140, servings: 8, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 280, protein_g: 5, carbs_g: 32, fat_g: 15, fiber_g: 1, sodium_mg: 280,
      ingredients: [
        { name: "Bread flour", quantity: 3, unit: "cups", aisle: "Baking" },
        { name: "Butter", quantity: 1, unit: "lb", aisle: "Dairy" },
        { name: "Yeast", quantity: 2, unit: "tsp", aisle: "Baking" }
      ],
      steps: ["Make and rest dough.", "Laminate with butter.", "Shape, proof, and bake until golden."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Fresh baked croissants with golden flaky layers, butter glistening, French pastry, food photography"
    }
  ],
  Greek: [
    {
      title: "Spanakopita",
      description: "Flaky phyllo pie with spinach and feta cheese",
      prep_time: 30, cook_time: 45, total_time: 75, servings: 8, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 10, carbs_g: 22, fat_g: 18, fiber_g: 3, sodium_mg: 520,
      ingredients: [
        { name: "Phyllo dough", quantity: 1, unit: "package", aisle: "Frozen" },
        { name: "Fresh spinach", quantity: 2, unit: "lbs", aisle: "Produce" },
        { name: "Feta cheese", quantity: 8, unit: "oz", aisle: "Dairy" }
      ],
      steps: ["Wilt and squeeze spinach dry.", "Mix with feta and herbs.", "Layer phyllo with filling and bake."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Golden spanakopita with flaky phyllo layers, spinach feta filling visible, Greek cuisine, food photography"
    },
    {
      title: "Souvlaki",
      description: "Grilled meat skewers with tzatziki and pita",
      prep_time: 20, cook_time: 15, total_time: 35, servings: 4, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 380, protein_g: 32, carbs_g: 24, fat_g: 18, fiber_g: 2, sodium_mg: 580,
      ingredients: [
        { name: "Pork tenderloin", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Pita bread", quantity: 4, unit: "rounds", aisle: "Bakery" },
        { name: "Greek yogurt", quantity: 1, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Marinate cubed meat in lemon and oregano.", "Skewer and grill.", "Serve in pita with tzatziki."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }],
      image_prompt: "Greek souvlaki skewers with grilled pork, tzatziki, tomatoes, onions, pita bread, street food, food photography"
    },
    {
      title: "Gyro",
      description: "Sliced seasoned meat in pita with toppings",
      prep_time: 25, cook_time: 20, total_time: 45, servings: 4, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 450, protein_g: 28, carbs_g: 38, fat_g: 22, fiber_g: 3, sodium_mg: 720,
      ingredients: [
        { name: "Ground lamb and beef", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Pita bread", quantity: 4, unit: "rounds", aisle: "Bakery" },
        { name: "Cucumber", quantity: 1, unit: "medium", aisle: "Produce" }
      ],
      steps: ["Form meat loaf with spices.", "Roast and slice thin.", "Serve in pita with toppings."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "lamb" }],
      image_prompt: "Greek gyro wrapped in pita with sliced meat, tzatziki, tomatoes, onions, Greek street food, food photography"
    },
    {
      title: "Pastitsio",
      description: "Greek baked pasta with meat sauce and béchamel",
      prep_time: 40, cook_time: 60, total_time: 100, servings: 8, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 480, protein_g: 24, carbs_g: 42, fat_g: 24, fiber_g: 3, sodium_mg: 720,
      ingredients: [
        { name: "Penne pasta", quantity: 1, unit: "lb", aisle: "Pasta" },
        { name: "Ground beef", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Béchamel sauce", quantity: 3, unit: "cups", aisle: "Dairy" }
      ],
      steps: ["Layer pasta with meat sauce.", "Top with thick béchamel.", "Bake until golden."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "beef" }],
      image_prompt: "Slice of pastitsio showing layers of pasta, meat sauce, creamy béchamel top, Greek comfort food, food photography"
    },
    {
      title: "Tzatziki",
      description: "Cool cucumber yogurt dip with garlic and dill",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 6, difficulty: "easy",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 60, protein_g: 4, carbs_g: 5, fat_g: 3, fiber_g: 0, sodium_mg: 120,
      ingredients: [
        { name: "Greek yogurt", quantity: 2, unit: "cups", aisle: "Dairy" },
        { name: "Cucumber", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Garlic", quantity: 2, unit: "cloves", aisle: "Produce" }
      ],
      steps: ["Grate and squeeze cucumber dry.", "Mix with yogurt, garlic, dill.", "Chill before serving."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Creamy tzatziki dip in bowl with olive oil drizzle, fresh dill, pita chips, Greek mezze, food photography"
    },
    {
      title: "Baklava",
      description: "Layered phyllo pastry with nuts and honey syrup",
      prep_time: 40, cook_time: 45, total_time: 85, servings: 16, difficulty: "hard",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 280, protein_g: 4, carbs_g: 38, fat_g: 14, fiber_g: 2, sodium_mg: 120,
      ingredients: [
        { name: "Phyllo dough", quantity: 1, unit: "package", aisle: "Frozen" },
        { name: "Walnuts", quantity: 2, unit: "cups", aisle: "Baking" },
        { name: "Honey", quantity: 1, unit: "cup", aisle: "Baking" }
      ],
      steps: ["Layer phyllo with butter and nuts.", "Cut into diamonds before baking.", "Pour honey syrup over hot baklava."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegetarian" }],
      image_prompt: "Golden baklava diamonds with flaky layers, crushed walnuts, glistening honey syrup, Greek dessert, food photography"
    },
    {
      title: "Avgolemono Soup",
      description: "Creamy lemon chicken soup with orzo",
      prep_time: 15, cook_time: 30, total_time: 45, servings: 6, difficulty: "medium",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 18, carbs_g: 22, fat_g: 8, fiber_g: 1, sodium_mg: 580,
      ingredients: [
        { name: "Chicken broth", quantity: 8, unit: "cups", aisle: "Canned Goods" },
        { name: "Orzo pasta", quantity: 0.5, unit: "cup", aisle: "Pasta" },
        { name: "Eggs", quantity: 3, unit: "large", aisle: "Dairy" }
      ],
      steps: ["Cook orzo in chicken broth.", "Temper eggs with lemon juice.", "Stir into soup for creamy texture."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "protein", tag_value: "chicken" }],
      image_prompt: "Bowl of avgolemono soup with creamy lemon texture, shredded chicken, orzo, fresh dill, Greek comfort food, food photography"
    },
    {
      title: "Grilled Octopus",
      description: "Tender charred octopus with olive oil and lemon",
      prep_time: 20, cook_time: 60, total_time: 80, servings: 4, difficulty: "hard",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 280, protein_g: 32, carbs_g: 6, fat_g: 14, fiber_g: 0, sodium_mg: 420,
      ingredients: [
        { name: "Octopus", quantity: 2, unit: "lbs", aisle: "Seafood" },
        { name: "Olive oil", quantity: 0.25, unit: "cup", aisle: "Oils" },
        { name: "Lemons", quantity: 2, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Simmer octopus until tender.", "Grill until charred.", "Dress with olive oil and lemon."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "seafood" }],
      image_prompt: "Grilled octopus tentacles with char marks, olive oil, lemon wedges, Greek island cuisine, food photography"
    }
  ]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cuisine, limit } = await req.json();
    
    const cuisineRecipes = recipesByCuisine[cuisine];
    if (!cuisineRecipes) {
      return new Response(
        JSON.stringify({ error: `Unknown cuisine: ${cuisine}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const recipesToAdd = cuisineRecipes.slice(0, limit || cuisineRecipes.length);
    const results: any[] = [];

    for (const recipe of recipesToAdd) {
      // Check if recipe already exists
      const { data: existing } = await supabase
        .from("recipes")
        .select("id")
        .eq("title", recipe.title)
        .eq("scope", "global")
        .maybeSingle();

      if (existing) {
        results.push({ title: recipe.title, status: "exists" });
        continue;
      }

      // Calculate serving_size using AI Chef rules
      const servingSize = await calculateServingSize(
        recipe.title,
        recipe.servings,
        recipe.ingredients,
        LOVABLE_API_KEY
      );

      // Generate AI image based on ingredients for accuracy
      const generatedImage = await generateRecipeImage(
        recipe.title,
        recipe.description,
        recipe.ingredients,
        LOVABLE_API_KEY
      );
      
      // Use AI-generated image or fallback to static image
      const imageUrl = generatedImage || getStaticImageUrl(recipe.title);

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
          cuisine: cuisine,
          is_kid_friendly: recipe.is_kid_friendly,
          is_meal_prep_friendly: recipe.is_meal_prep_friendly,
          is_budget_friendly: recipe.is_budget_friendly,
          scope: "global",
          owner_user_id: null,
          image_url: imageUrl
        })
        .select()
        .single();

      if (recipeError) {
        results.push({ title: recipe.title, status: "error", error: recipeError.message });
        continue;
      }

      // Insert nutrition
      await supabase.from("recipe_nutrition").insert({
        recipe_id: newRecipe.id,
        calories: recipe.calories,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
        fiber_g: recipe.fiber_g,
        sodium_mg: recipe.sodium_mg
      });

      // Insert ingredients
      for (let i = 0; i < recipe.ingredients.length; i++) {
        const ing = recipe.ingredients[i];
        await supabase.from("recipe_ingredients").insert({
          recipe_id: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          aisle: ing.aisle,
          order_index: i,
          normalized_name: ing.name.toLowerCase()
        });
      }

      // Insert steps
      for (let i = 0; i < recipe.steps.length; i++) {
        await supabase.from("recipe_steps").insert({
          recipe_id: newRecipe.id,
          step_number: i + 1,
          instruction: recipe.steps[i]
        });
      }

      // Insert tags
      for (const tag of recipe.tags) {
        await supabase.from("recipe_tags").insert({
          recipe_id: newRecipe.id,
          tag_type: tag.tag_type,
          tag_value: tag.tag_value
        });
      }

      results.push({ 
        title: recipe.title, 
        status: "created", 
        id: newRecipe.id,
        image_prompt: recipe.image_prompt 
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
