import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Generate AI image based on recipe title and ingredients for accuracy
async function generateRecipeImage(
  title: string,
  description: string,
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
  apiKey: string
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

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC with actual piece counts or weights.

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

// Seed recipes data
const seedRecipes = [
  {
    id: 'seed-1',
    title: 'Greek Yogurt Power Bowl',
    description: 'Creamy Greek yogurt topped with fresh berries, honey, and crunchy granola',
    servings: 1,
    prep_time: 5,
    cook_time: 0,
    total_time: 5,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 320, protein_g: 18, carbs_g: 42, fat_g: 10, fiber_g: 4, sodium_mg: 85, sugar_g: 24 },
    ingredients: [
      { name: 'Greek yogurt', quantity: 1, unit: 'cup', normalized_name: 'greek yogurt', aisle: 'Dairy', order_index: 0 },
      { name: 'Mixed berries', quantity: 0.5, unit: 'cup', normalized_name: 'mixed berries', aisle: 'Produce', order_index: 1 },
      { name: 'Granola', quantity: 0.25, unit: 'cup', normalized_name: 'granola', aisle: 'Breakfast', order_index: 2 },
      { name: 'Honey', quantity: 1, unit: 'tbsp', normalized_name: 'honey', aisle: 'Baking', order_index: 3 },
      { name: 'Chia seeds', quantity: 1, unit: 'tsp', normalized_name: 'chia seeds', aisle: 'Health Foods', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Add Greek yogurt to a bowl.' },
      { step_number: 2, instruction: 'Top with mixed berries and granola.' },
      { step_number: 3, instruction: 'Drizzle with honey and sprinkle chia seeds.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'quick', tag_value: 'under-10' },
    ],
  },
  {
    id: 'seed-2',
    title: 'Avocado Toast with Eggs',
    description: 'Crispy whole grain toast topped with smashed avocado and perfectly poached eggs',
    servings: 1,
    prep_time: 5,
    cook_time: 10,
    total_time: 15,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 16, carbs_g: 28, fat_g: 24, fiber_g: 8, sodium_mg: 420 },
    ingredients: [
      { name: 'Whole grain bread', quantity: 2, unit: 'slices', normalized_name: 'bread', aisle: 'Bakery', order_index: 0 },
      { name: 'Avocado', quantity: 1, unit: 'whole', normalized_name: 'avocado', aisle: 'Produce', order_index: 1 },
      { name: 'Eggs', quantity: 2, unit: 'large', normalized_name: 'eggs', aisle: 'Dairy', order_index: 2 },
      { name: 'Red pepper flakes', quantity: 0.25, unit: 'tsp', normalized_name: 'red pepper flakes', aisle: 'Spices', order_index: 3 },
      { name: 'Salt', quantity: 0.25, unit: 'tsp', normalized_name: 'salt', aisle: 'Spices', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Toast bread until golden and crispy.' },
      { step_number: 2, instruction: 'Mash avocado with salt and spread on toast.' },
      { step_number: 3, instruction: 'Poach eggs in simmering water for 3-4 minutes.' },
      { step_number: 4, instruction: 'Place eggs on avocado toast and sprinkle with red pepper flakes.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
    ],
  },
  {
    id: 'seed-3',
    title: 'Overnight Oats with Banana',
    description: 'Creamy overnight oats with banana, almond butter, and a touch of maple syrup',
    servings: 1,
    prep_time: 5,
    cook_time: 0,
    total_time: 5,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 12, carbs_g: 58, fat_g: 12, fiber_g: 8, sodium_mg: 150 },
    ingredients: [
      { name: 'Rolled oats', quantity: 0.5, unit: 'cup', normalized_name: 'oats', aisle: 'Breakfast', order_index: 0 },
      { name: 'Almond milk', quantity: 0.5, unit: 'cup', normalized_name: 'almond milk', aisle: 'Dairy', order_index: 1 },
      { name: 'Greek yogurt', quantity: 0.25, unit: 'cup', normalized_name: 'greek yogurt', aisle: 'Dairy', order_index: 2 },
      { name: 'Banana', quantity: 1, unit: 'medium', normalized_name: 'banana', aisle: 'Produce', order_index: 3 },
      { name: 'Almond butter', quantity: 1, unit: 'tbsp', normalized_name: 'almond butter', aisle: 'Spreads', order_index: 4 },
      { name: 'Maple syrup', quantity: 1, unit: 'tsp', normalized_name: 'maple syrup', aisle: 'Baking', order_index: 5 },
    ],
    steps: [
      { step_number: 1, instruction: 'Combine oats, almond milk, and yogurt in a jar.' },
      { step_number: 2, instruction: 'Add sliced banana and almond butter.' },
      { step_number: 3, instruction: 'Drizzle with maple syrup and stir.' },
      { step_number: 4, instruction: 'Refrigerate overnight or at least 4 hours.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-4',
    title: 'Mediterranean Quinoa Salad',
    description: 'Fresh and vibrant quinoa salad with cucumbers, tomatoes, feta, and lemon dressing',
    servings: 2,
    prep_time: 15,
    cook_time: 15,
    total_time: 30,
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 14, carbs_g: 42, fat_g: 18, fiber_g: 7, sodium_mg: 520 },
    ingredients: [
      { name: 'Quinoa', quantity: 1, unit: 'cup', normalized_name: 'quinoa', aisle: 'Grains', order_index: 0 },
      { name: 'Cucumber', quantity: 1, unit: 'medium', normalized_name: 'cucumber', aisle: 'Produce', order_index: 1 },
      { name: 'Cherry tomatoes', quantity: 1, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 2 },
      { name: 'Feta cheese', quantity: 0.5, unit: 'cup', normalized_name: 'feta', aisle: 'Dairy', order_index: 3 },
      { name: 'Kalamata olives', quantity: 0.25, unit: 'cup', normalized_name: 'olives', aisle: 'Canned Goods', order_index: 4 },
      { name: 'Red onion', quantity: 0.25, unit: 'whole', normalized_name: 'red onion', aisle: 'Produce', order_index: 5 },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 6 },
      { name: 'Lemon juice', quantity: 2, unit: 'tbsp', normalized_name: 'lemon juice', aisle: 'Produce', order_index: 7 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cook quinoa according to package directions and let cool.' },
      { step_number: 2, instruction: 'Dice cucumber, halve tomatoes, and slice red onion.' },
      { step_number: 3, instruction: 'Combine all vegetables with cooled quinoa.' },
      { step_number: 4, instruction: 'Add feta and olives.' },
      { step_number: 5, instruction: 'Whisk olive oil and lemon juice, pour over salad and toss.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'diet', tag_value: 'mediterranean' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-5',
    title: 'Grilled Chicken Caesar Wrap',
    description: 'Tender grilled chicken with crisp romaine and creamy Caesar dressing in a whole wheat wrap',
    servings: 1,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 450, protein_g: 38, carbs_g: 32, fat_g: 18, fiber_g: 4, sodium_mg: 680 },
    ingredients: [
      { name: 'Chicken breast', quantity: 5, unit: 'oz', normalized_name: 'chicken breast', aisle: 'Meat', order_index: 0 },
      { name: 'Whole wheat wrap', quantity: 1, unit: 'large', normalized_name: 'wrap', aisle: 'Bakery', order_index: 1 },
      { name: 'Romaine lettuce', quantity: 1, unit: 'cup', normalized_name: 'romaine', aisle: 'Produce', order_index: 2 },
      { name: 'Parmesan cheese', quantity: 2, unit: 'tbsp', normalized_name: 'parmesan', aisle: 'Dairy', order_index: 3 },
      { name: 'Caesar dressing', quantity: 2, unit: 'tbsp', normalized_name: 'caesar dressing', aisle: 'Condiments', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Season chicken breast and grill until cooked through, about 6-7 minutes per side.' },
      { step_number: 2, instruction: 'Let chicken rest, then slice into strips.' },
      { step_number: 3, instruction: 'Warm the wrap slightly.' },
      { step_number: 4, instruction: 'Layer romaine, chicken, and parmesan on wrap.' },
      { step_number: 5, instruction: 'Drizzle with Caesar dressing, fold, and serve.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'protein', tag_value: 'chicken' },
    ],
  },
  {
    id: 'seed-6',
    title: 'Lemon Herb Salmon',
    description: 'Flaky baked salmon with fresh herbs, lemon, and a side of roasted vegetables',
    servings: 2,
    prep_time: 10,
    cook_time: 20,
    total_time: 30,
    cuisine: 'American',
    difficulty: 'medium',
    image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: true,
    is_budget_friendly: false,
    nutrition: { calories: 420, protein_g: 42, carbs_g: 12, fat_g: 22, fiber_g: 4, sodium_mg: 380 },
    ingredients: [
      { name: 'Salmon fillet', quantity: 12, unit: 'oz', normalized_name: 'salmon', aisle: 'Seafood', order_index: 0 },
      { name: 'Lemon', quantity: 1, unit: 'whole', normalized_name: 'lemon', aisle: 'Produce', order_index: 1 },
      { name: 'Fresh dill', quantity: 2, unit: 'tbsp', normalized_name: 'dill', aisle: 'Produce', order_index: 2 },
      { name: 'Garlic', quantity: 3, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 3 },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 4 },
      { name: 'Asparagus', quantity: 1, unit: 'bunch', normalized_name: 'asparagus', aisle: 'Produce', order_index: 5 },
    ],
    steps: [
      { step_number: 1, instruction: 'Preheat oven to 400°F (200°C).' },
      { step_number: 2, instruction: 'Place salmon on a baking sheet, drizzle with olive oil.' },
      { step_number: 3, instruction: 'Top with minced garlic, lemon slices, and fresh dill.' },
      { step_number: 4, instruction: 'Arrange asparagus around salmon, season with salt and pepper.' },
      { step_number: 5, instruction: 'Bake for 15-20 minutes until salmon flakes easily.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'pescatarian' },
      { tag_type: 'diet', tag_value: 'keto' },
      { tag_type: 'medical', tag_value: 'heart-healthy' },
    ],
  },
  {
    id: 'seed-7',
    title: 'Turkey Taco Lettuce Wraps',
    description: 'Lean ground turkey with Mexican spices served in crisp lettuce cups',
    servings: 4,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'Mexican',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 280, protein_g: 28, carbs_g: 12, fat_g: 14, fiber_g: 3, sodium_mg: 420 },
    ingredients: [
      { name: 'Ground turkey', quantity: 1, unit: 'lb', normalized_name: 'ground turkey', aisle: 'Meat', order_index: 0 },
      { name: 'Butter lettuce', quantity: 1, unit: 'head', normalized_name: 'butter lettuce', aisle: 'Produce', order_index: 1 },
      { name: 'Taco seasoning', quantity: 2, unit: 'tbsp', normalized_name: 'taco seasoning', aisle: 'Spices', order_index: 2 },
      { name: 'Black beans', quantity: 0.5, unit: 'cup', normalized_name: 'black beans', aisle: 'Canned Goods', order_index: 3 },
      { name: 'Avocado', quantity: 1, unit: 'whole', normalized_name: 'avocado', aisle: 'Produce', order_index: 4 },
      { name: 'Salsa', quantity: 0.5, unit: 'cup', normalized_name: 'salsa', aisle: 'Condiments', order_index: 5 },
      { name: 'Lime', quantity: 1, unit: 'whole', normalized_name: 'lime', aisle: 'Produce', order_index: 6 },
    ],
    steps: [
      { step_number: 1, instruction: 'Brown ground turkey in a skillet over medium-high heat.' },
      { step_number: 2, instruction: 'Add taco seasoning and black beans, cook for 3-4 minutes.' },
      { step_number: 3, instruction: 'Separate lettuce leaves into cups.' },
      { step_number: 4, instruction: 'Fill each lettuce cup with turkey mixture.' },
      { step_number: 5, instruction: 'Top with diced avocado, salsa, and a squeeze of lime.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'protein', tag_value: 'turkey' },
      { tag_type: 'diet', tag_value: 'keto' },
      { tag_type: 'medical', tag_value: 'diabetes-friendly' },
    ],
  },
  {
    id: 'seed-8',
    title: 'One-Pan Chicken & Vegetables',
    description: 'Juicy chicken thighs roasted with seasonal vegetables and herbs',
    servings: 4,
    prep_time: 15,
    cook_time: 40,
    total_time: 55,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 32, carbs_g: 24, fat_g: 18, fiber_g: 5, sodium_mg: 480 },
    ingredients: [
      { name: 'Chicken thighs', quantity: 4, unit: 'pieces', normalized_name: 'chicken thighs', aisle: 'Meat', order_index: 0 },
      { name: 'Baby potatoes', quantity: 1, unit: 'lb', normalized_name: 'baby potatoes', aisle: 'Produce', order_index: 1 },
      { name: 'Broccoli', quantity: 2, unit: 'cups', normalized_name: 'broccoli', aisle: 'Produce', order_index: 2 },
      { name: 'Carrots', quantity: 2, unit: 'medium', normalized_name: 'carrots', aisle: 'Produce', order_index: 3 },
      { name: 'Olive oil', quantity: 3, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 4 },
      { name: 'Italian seasoning', quantity: 1, unit: 'tbsp', normalized_name: 'italian seasoning', aisle: 'Spices', order_index: 5 },
      { name: 'Garlic powder', quantity: 1, unit: 'tsp', normalized_name: 'garlic powder', aisle: 'Spices', order_index: 6 },
    ],
    steps: [
      { step_number: 1, instruction: 'Preheat oven to 425°F (220°C).' },
      { step_number: 2, instruction: 'Halve potatoes and chop carrots. Toss vegetables with olive oil and seasonings.' },
      { step_number: 3, instruction: 'Arrange vegetables on a large baking sheet.' },
      { step_number: 4, instruction: 'Season chicken thighs and place on top of vegetables.' },
      { step_number: 5, instruction: 'Roast for 35-40 minutes until chicken is golden and cooked through.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'protein', tag_value: 'chicken' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-9',
    title: 'Hummus & Veggie Plate',
    description: 'Creamy hummus with fresh cut vegetables for dipping',
    servings: 2,
    prep_time: 10,
    cook_time: 0,
    total_time: 10,
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 220, protein_g: 8, carbs_g: 28, fat_g: 10, fiber_g: 8, sodium_mg: 380 },
    ingredients: [
      { name: 'Hummus', quantity: 0.5, unit: 'cup', normalized_name: 'hummus', aisle: 'Deli', order_index: 0 },
      { name: 'Carrots', quantity: 2, unit: 'medium', normalized_name: 'carrots', aisle: 'Produce', order_index: 1 },
      { name: 'Cucumber', quantity: 1, unit: 'medium', normalized_name: 'cucumber', aisle: 'Produce', order_index: 2 },
      { name: 'Bell pepper', quantity: 1, unit: 'medium', normalized_name: 'bell pepper', aisle: 'Produce', order_index: 3 },
      { name: 'Cherry tomatoes', quantity: 0.5, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cut vegetables into sticks or bite-sized pieces.' },
      { step_number: 2, instruction: 'Arrange around a bowl of hummus.' },
      { step_number: 3, instruction: 'Drizzle hummus with olive oil if desired.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'diet', tag_value: 'mediterranean' },
    ],
  },
  {
    id: 'seed-10',
    title: 'Spinach & Feta Stuffed Chicken',
    description: 'Tender chicken breasts filled with creamy spinach and feta',
    servings: 4,
    prep_time: 20,
    cook_time: 25,
    total_time: 45,
    cuisine: 'Mediterranean',
    difficulty: 'medium',
    image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 340, protein_g: 42, carbs_g: 4, fat_g: 18, fiber_g: 1, sodium_mg: 520 },
    ingredients: [
      { name: 'Chicken breasts', quantity: 4, unit: 'pieces', normalized_name: 'chicken breast', aisle: 'Meat', order_index: 0 },
      { name: 'Fresh spinach', quantity: 2, unit: 'cups', normalized_name: 'spinach', aisle: 'Produce', order_index: 1 },
      { name: 'Feta cheese', quantity: 0.5, unit: 'cup', normalized_name: 'feta', aisle: 'Dairy', order_index: 2 },
      { name: 'Cream cheese', quantity: 2, unit: 'oz', normalized_name: 'cream cheese', aisle: 'Dairy', order_index: 3 },
      { name: 'Garlic', quantity: 2, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Preheat oven to 375°F (190°C).' },
      { step_number: 2, instruction: 'Mix spinach, feta, cream cheese, and minced garlic.' },
      { step_number: 3, instruction: 'Cut a pocket in each chicken breast.' },
      { step_number: 4, instruction: 'Stuff with spinach mixture and secure with toothpicks.' },
      { step_number: 5, instruction: 'Bake for 25-30 minutes until chicken is cooked through.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'keto' },
      { tag_type: 'protein', tag_value: 'chicken' },
    ],
  },
  {
    id: 'seed-11',
    title: 'Shrimp Stir-Fry',
    description: 'Quick and colorful shrimp stir-fry with vegetables in a savory sauce',
    servings: 3,
    prep_time: 15,
    cook_time: 10,
    total_time: 25,
    cuisine: 'Asian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: false,
    nutrition: { calories: 280, protein_g: 28, carbs_g: 18, fat_g: 12, fiber_g: 4, sodium_mg: 680 },
    ingredients: [
      { name: 'Shrimp', quantity: 1, unit: 'lb', normalized_name: 'shrimp', aisle: 'Seafood', order_index: 0 },
      { name: 'Broccoli', quantity: 2, unit: 'cups', normalized_name: 'broccoli', aisle: 'Produce', order_index: 1 },
      { name: 'Bell peppers', quantity: 2, unit: 'medium', normalized_name: 'bell peppers', aisle: 'Produce', order_index: 2 },
      { name: 'Soy sauce', quantity: 3, unit: 'tbsp', normalized_name: 'soy sauce', aisle: 'Asian', order_index: 3 },
      { name: 'Sesame oil', quantity: 1, unit: 'tbsp', normalized_name: 'sesame oil', aisle: 'Asian', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Heat oil in a wok over high heat.' },
      { step_number: 2, instruction: 'Add shrimp and cook until pink, about 2 minutes. Remove.' },
      { step_number: 3, instruction: 'Stir-fry vegetables until crisp-tender.' },
      { step_number: 4, instruction: 'Return shrimp, add soy sauce and sesame oil.' },
      { step_number: 5, instruction: 'Toss everything together and serve.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'pescatarian' },
    ],
  },
  {
    id: 'seed-12',
    title: 'Apple Slices with Almond Butter',
    description: 'Fresh apple slices with creamy almond butter for dipping',
    servings: 1,
    prep_time: 5,
    cook_time: 0,
    total_time: 5,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1568702846914-96b305d2ead1?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 280, protein_g: 7, carbs_g: 32, fat_g: 16, fiber_g: 6, sodium_mg: 2 },
    ingredients: [
      { name: 'Apple', quantity: 1, unit: 'large', normalized_name: 'apple', aisle: 'Produce', order_index: 0 },
      { name: 'Almond butter', quantity: 2, unit: 'tbsp', normalized_name: 'almond butter', aisle: 'Spreads', order_index: 1 },
    ],
    steps: [
      { step_number: 1, instruction: 'Slice apple into wedges.' },
      { step_number: 2, instruction: 'Serve with almond butter for dipping.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'quick', tag_value: 'under-10' },
    ],
  },
  {
    id: 'seed-13',
    title: 'Vegetable Soup',
    description: 'Hearty homemade vegetable soup with herbs and seasonings',
    servings: 6,
    prep_time: 15,
    cook_time: 30,
    total_time: 45,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 120, protein_g: 4, carbs_g: 22, fat_g: 3, fiber_g: 5, sodium_mg: 480 },
    ingredients: [
      { name: 'Vegetable broth', quantity: 6, unit: 'cups', normalized_name: 'vegetable broth', aisle: 'Canned Goods', order_index: 0 },
      { name: 'Carrots', quantity: 3, unit: 'medium', normalized_name: 'carrots', aisle: 'Produce', order_index: 1 },
      { name: 'Celery', quantity: 3, unit: 'stalks', normalized_name: 'celery', aisle: 'Produce', order_index: 2 },
      { name: 'Potatoes', quantity: 2, unit: 'medium', normalized_name: 'potatoes', aisle: 'Produce', order_index: 3 },
      { name: 'Green beans', quantity: 1, unit: 'cup', normalized_name: 'green beans', aisle: 'Produce', order_index: 4 },
      { name: 'Diced tomatoes', quantity: 1, unit: 'can', normalized_name: 'diced tomatoes', aisle: 'Canned Goods', order_index: 5 },
    ],
    steps: [
      { step_number: 1, instruction: 'Dice all vegetables into bite-sized pieces.' },
      { step_number: 2, instruction: 'Bring broth to a boil in a large pot.' },
      { step_number: 3, instruction: 'Add vegetables and tomatoes.' },
      { step_number: 4, instruction: 'Simmer for 25-30 minutes until vegetables are tender.' },
      { step_number: 5, instruction: 'Season with salt, pepper, and herbs.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-14',
    title: 'Tuna Salad Lettuce Wraps',
    description: 'Light and protein-packed tuna salad in crisp lettuce cups',
    servings: 2,
    prep_time: 10,
    cook_time: 0,
    total_time: 10,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 220, protein_g: 28, carbs_g: 6, fat_g: 10, fiber_g: 2, sodium_mg: 420 },
    ingredients: [
      { name: 'Canned tuna', quantity: 2, unit: 'cans', normalized_name: 'tuna', aisle: 'Canned Goods', order_index: 0 },
      { name: 'Greek yogurt', quantity: 2, unit: 'tbsp', normalized_name: 'greek yogurt', aisle: 'Dairy', order_index: 1 },
      { name: 'Celery', quantity: 1, unit: 'stalk', normalized_name: 'celery', aisle: 'Produce', order_index: 2 },
      { name: 'Butter lettuce', quantity: 1, unit: 'head', normalized_name: 'butter lettuce', aisle: 'Produce', order_index: 3 },
      { name: 'Lemon juice', quantity: 1, unit: 'tbsp', normalized_name: 'lemon juice', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Drain tuna and mix with yogurt and lemon juice.' },
      { step_number: 2, instruction: 'Add diced celery and season to taste.' },
      { step_number: 3, instruction: 'Spoon into lettuce cups and serve.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'diet', tag_value: 'pescatarian' },
      { tag_type: 'diet', tag_value: 'keto' },
    ],
  },
  {
    id: 'seed-15',
    title: 'Honey Garlic Chicken',
    description: 'Sweet and savory chicken thighs glazed with honey and garlic',
    servings: 4,
    prep_time: 10,
    cook_time: 25,
    total_time: 35,
    cuisine: 'Asian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 32, carbs_g: 22, fat_g: 18, fiber_g: 2, sodium_mg: 540 },
    ingredients: [
      { name: 'Chicken thighs', quantity: 4, unit: 'pieces', normalized_name: 'chicken thighs', aisle: 'Meat', order_index: 0 },
      { name: 'Honey', quantity: 3, unit: 'tbsp', normalized_name: 'honey', aisle: 'Baking', order_index: 1 },
      { name: 'Soy sauce', quantity: 3, unit: 'tbsp', normalized_name: 'soy sauce', aisle: 'Asian', order_index: 2 },
      { name: 'Garlic', quantity: 4, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Mix honey, soy sauce, and minced garlic.' },
      { step_number: 2, instruction: 'Brown chicken thighs in a skillet.' },
      { step_number: 3, instruction: 'Pour sauce over chicken and simmer until cooked through.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'protein', tag_value: 'chicken' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-16',
    title: 'Caprese Salad',
    description: 'Fresh tomatoes, mozzarella, and basil with balsamic glaze',
    servings: 2,
    prep_time: 10,
    cook_time: 0,
    total_time: 10,
    cuisine: 'Italian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1608032077018-c9aad9565d29?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 220, protein_g: 12, carbs_g: 8, fat_g: 16, fiber_g: 2, sodium_mg: 320 },
    ingredients: [
      { name: 'Fresh mozzarella', quantity: 8, unit: 'oz', normalized_name: 'mozzarella', aisle: 'Dairy', order_index: 0 },
      { name: 'Tomatoes', quantity: 2, unit: 'large', normalized_name: 'tomatoes', aisle: 'Produce', order_index: 1 },
      { name: 'Fresh basil', quantity: 10, unit: 'leaves', normalized_name: 'basil', aisle: 'Produce', order_index: 2 },
      { name: 'Balsamic glaze', quantity: 2, unit: 'tbsp', normalized_name: 'balsamic glaze', aisle: 'Condiments', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Slice tomatoes and mozzarella.' },
      { step_number: 2, instruction: 'Arrange alternating slices with basil leaves.' },
      { step_number: 3, instruction: 'Drizzle with olive oil and balsamic glaze.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'diet', tag_value: 'keto' },
    ],
  },
  {
    id: 'seed-17',
    title: 'Beef Tacos',
    description: 'Seasoned ground beef in crispy shells with fresh toppings',
    servings: 4,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'Mexican',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 24, carbs_g: 28, fat_g: 20, fiber_g: 4, sodium_mg: 580 },
    ingredients: [
      { name: 'Ground beef', quantity: 1, unit: 'lb', normalized_name: 'ground beef', aisle: 'Meat', order_index: 0 },
      { name: 'Taco shells', quantity: 8, unit: 'shells', normalized_name: 'taco shells', aisle: 'Mexican', order_index: 1 },
      { name: 'Taco seasoning', quantity: 1, unit: 'packet', normalized_name: 'taco seasoning', aisle: 'Spices', order_index: 2 },
      { name: 'Shredded cheese', quantity: 1, unit: 'cup', normalized_name: 'shredded cheese', aisle: 'Dairy', order_index: 3 },
      { name: 'Lettuce', quantity: 2, unit: 'cups', normalized_name: 'lettuce', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Brown ground beef and drain.' },
      { step_number: 2, instruction: 'Add taco seasoning and water, simmer.' },
      { step_number: 3, instruction: 'Fill taco shells with beef, cheese, and lettuce.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'protein', tag_value: 'beef' },
    ],
  },
  {
    id: 'seed-18',
    title: 'Smoothie Bowl',
    description: 'Thick blended fruit bowl with granola and fresh toppings',
    servings: 1,
    prep_time: 10,
    cook_time: 0,
    total_time: 10,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 340, protein_g: 8, carbs_g: 62, fat_g: 8, fiber_g: 8, sodium_mg: 45 },
    ingredients: [
      { name: 'Frozen berries', quantity: 1, unit: 'cup', normalized_name: 'frozen berries', aisle: 'Frozen', order_index: 0 },
      { name: 'Banana', quantity: 1, unit: 'frozen', normalized_name: 'banana', aisle: 'Produce', order_index: 1 },
      { name: 'Almond milk', quantity: 0.5, unit: 'cup', normalized_name: 'almond milk', aisle: 'Dairy', order_index: 2 },
      { name: 'Granola', quantity: 0.25, unit: 'cup', normalized_name: 'granola', aisle: 'Breakfast', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Blend frozen fruit with almond milk until thick.' },
      { step_number: 2, instruction: 'Pour into a bowl.' },
      { step_number: 3, instruction: 'Top with granola and fresh fruit.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'diet', tag_value: 'vegan' },
    ],
  },
  {
    id: 'seed-19',
    title: 'Pasta Primavera',
    description: 'Colorful vegetables tossed with pasta in a light garlic sauce',
    servings: 4,
    prep_time: 15,
    cook_time: 20,
    total_time: 35,
    cuisine: 'Italian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 12, carbs_g: 58, fat_g: 12, fiber_g: 6, sodium_mg: 320 },
    ingredients: [
      { name: 'Penne pasta', quantity: 12, unit: 'oz', normalized_name: 'pasta', aisle: 'Pasta', order_index: 0 },
      { name: 'Zucchini', quantity: 1, unit: 'medium', normalized_name: 'zucchini', aisle: 'Produce', order_index: 1 },
      { name: 'Bell peppers', quantity: 2, unit: 'medium', normalized_name: 'bell peppers', aisle: 'Produce', order_index: 2 },
      { name: 'Cherry tomatoes', quantity: 1, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 3 },
      { name: 'Garlic', quantity: 3, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 4 },
      { name: 'Olive oil', quantity: 3, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 5 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cook pasta according to package directions.' },
      { step_number: 2, instruction: 'Sauté vegetables in olive oil with garlic.' },
      { step_number: 3, instruction: 'Toss pasta with vegetables and season.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-20',
    title: 'Baked Sweet Potato',
    description: 'Tender baked sweet potato with black beans and avocado',
    servings: 1,
    prep_time: 5,
    cook_time: 45,
    total_time: 50,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1596097557994-d900f27bb64b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 340, protein_g: 12, carbs_g: 52, fat_g: 10, fiber_g: 14, sodium_mg: 280 },
    ingredients: [
      { name: 'Sweet potato', quantity: 1, unit: 'large', normalized_name: 'sweet potato', aisle: 'Produce', order_index: 0 },
      { name: 'Black beans', quantity: 0.5, unit: 'cup', normalized_name: 'black beans', aisle: 'Canned Goods', order_index: 1 },
      { name: 'Avocado', quantity: 0.5, unit: 'whole', normalized_name: 'avocado', aisle: 'Produce', order_index: 2 },
      { name: 'Greek yogurt', quantity: 2, unit: 'tbsp', normalized_name: 'greek yogurt', aisle: 'Dairy', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Preheat oven to 400°F. Pierce sweet potato with a fork.' },
      { step_number: 2, instruction: 'Bake for 45 minutes until tender.' },
      { step_number: 3, instruction: 'Split open and top with beans, avocado, and yogurt.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
    ],
  },
  {
    id: 'seed-21',
    title: 'Teriyaki Salmon Bowl',
    description: 'Glazed salmon over rice with edamame and pickled vegetables',
    servings: 2,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'Japanese',
    difficulty: 'medium',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: false,
    nutrition: { calories: 480, protein_g: 38, carbs_g: 42, fat_g: 18, fiber_g: 4, sodium_mg: 680 },
    ingredients: [
      { name: 'Salmon fillet', quantity: 10, unit: 'oz', normalized_name: 'salmon', aisle: 'Seafood', order_index: 0 },
      { name: 'Teriyaki sauce', quantity: 3, unit: 'tbsp', normalized_name: 'teriyaki sauce', aisle: 'Asian', order_index: 1 },
      { name: 'Sushi rice', quantity: 1, unit: 'cup', normalized_name: 'sushi rice', aisle: 'Grains', order_index: 2 },
      { name: 'Edamame', quantity: 0.5, unit: 'cup', normalized_name: 'edamame', aisle: 'Frozen', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cook rice according to package directions.' },
      { step_number: 2, instruction: 'Brush salmon with teriyaki sauce and bake at 400°F for 12-15 minutes.' },
      { step_number: 3, instruction: 'Assemble bowls with rice, salmon, and edamame.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'pescatarian' },
      { tag_type: 'medical', tag_value: 'heart-healthy' },
    ],
  },
  {
    id: 'seed-22',
    title: 'Greek Chicken Skewers',
    description: 'Marinated chicken kebabs with tzatziki and pita',
    servings: 4,
    prep_time: 15,
    cook_time: 15,
    total_time: 30,
    cuisine: 'Greek',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 340, protein_g: 32, carbs_g: 18, fat_g: 16, fiber_g: 2, sodium_mg: 420 },
    ingredients: [
      { name: 'Chicken breast', quantity: 1.5, unit: 'lb', normalized_name: 'chicken breast', aisle: 'Meat', order_index: 0 },
      { name: 'Greek yogurt', quantity: 0.5, unit: 'cup', normalized_name: 'greek yogurt', aisle: 'Dairy', order_index: 1 },
      { name: 'Lemon', quantity: 1, unit: 'whole', normalized_name: 'lemon', aisle: 'Produce', order_index: 2 },
      { name: 'Oregano', quantity: 1, unit: 'tbsp', normalized_name: 'oregano', aisle: 'Spices', order_index: 3 },
      { name: 'Pita bread', quantity: 4, unit: 'pieces', normalized_name: 'pita', aisle: 'Bakery', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cube chicken and marinate in yogurt, lemon, and oregano.' },
      { step_number: 2, instruction: 'Thread onto skewers.' },
      { step_number: 3, instruction: 'Grill for 12-15 minutes, turning occasionally.' },
      { step_number: 4, instruction: 'Serve with warm pita and tzatziki.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'mediterranean' },
      { tag_type: 'protein', tag_value: 'chicken' },
    ],
  },
  {
    id: 'seed-23',
    title: 'Egg Fried Rice',
    description: 'Quick and easy fried rice with vegetables and scrambled eggs',
    servings: 3,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'Asian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 320, protein_g: 12, carbs_g: 42, fat_g: 12, fiber_g: 3, sodium_mg: 580 },
    ingredients: [
      { name: 'Cooked rice', quantity: 3, unit: 'cups', normalized_name: 'rice', aisle: 'Grains', order_index: 0 },
      { name: 'Eggs', quantity: 3, unit: 'large', normalized_name: 'eggs', aisle: 'Dairy', order_index: 1 },
      { name: 'Frozen peas and carrots', quantity: 1, unit: 'cup', normalized_name: 'peas and carrots', aisle: 'Frozen', order_index: 2 },
      { name: 'Soy sauce', quantity: 2, unit: 'tbsp', normalized_name: 'soy sauce', aisle: 'Asian', order_index: 3 },
      { name: 'Green onions', quantity: 3, unit: 'stalks', normalized_name: 'green onions', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Scramble eggs in a hot wok, set aside.' },
      { step_number: 2, instruction: 'Stir-fry vegetables until tender.' },
      { step_number: 3, instruction: 'Add cold rice and soy sauce, toss until heated through.' },
      { step_number: 4, instruction: 'Mix in eggs and garnish with green onions.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
    ],
  },
  {
    id: 'seed-24',
    title: 'Black Bean Soup',
    description: 'Hearty and flavorful black bean soup with cumin and lime',
    servings: 6,
    prep_time: 10,
    cook_time: 30,
    total_time: 40,
    cuisine: 'Mexican',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 220, protein_g: 12, carbs_g: 38, fat_g: 4, fiber_g: 12, sodium_mg: 480 },
    ingredients: [
      { name: 'Black beans', quantity: 2, unit: 'cans', normalized_name: 'black beans', aisle: 'Canned Goods', order_index: 0 },
      { name: 'Vegetable broth', quantity: 4, unit: 'cups', normalized_name: 'vegetable broth', aisle: 'Canned Goods', order_index: 1 },
      { name: 'Onion', quantity: 1, unit: 'medium', normalized_name: 'onion', aisle: 'Produce', order_index: 2 },
      { name: 'Cumin', quantity: 1, unit: 'tbsp', normalized_name: 'cumin', aisle: 'Spices', order_index: 3 },
      { name: 'Lime', quantity: 1, unit: 'whole', normalized_name: 'lime', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Sauté diced onion until soft.' },
      { step_number: 2, instruction: 'Add beans, broth, and cumin. Simmer 25 minutes.' },
      { step_number: 3, instruction: 'Blend half for creamier texture.' },
      { step_number: 4, instruction: 'Serve with lime wedges and sour cream.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-25',
    title: 'Cottage Cheese Fruit Bowl',
    description: 'Protein-rich cottage cheese with fresh fruit and honey',
    servings: 1,
    prep_time: 5,
    cook_time: 0,
    total_time: 5,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 280, protein_g: 24, carbs_g: 32, fat_g: 6, fiber_g: 3, sodium_mg: 420 },
    ingredients: [
      { name: 'Cottage cheese', quantity: 1, unit: 'cup', normalized_name: 'cottage cheese', aisle: 'Dairy', order_index: 0 },
      { name: 'Peaches', quantity: 1, unit: 'medium', normalized_name: 'peaches', aisle: 'Produce', order_index: 1 },
      { name: 'Blueberries', quantity: 0.25, unit: 'cup', normalized_name: 'blueberries', aisle: 'Produce', order_index: 2 },
      { name: 'Honey', quantity: 1, unit: 'tbsp', normalized_name: 'honey', aisle: 'Baking', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Add cottage cheese to a bowl.' },
      { step_number: 2, instruction: 'Top with sliced peaches and blueberries.' },
      { step_number: 3, instruction: 'Drizzle with honey and serve.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
    ],
  },
  {
    id: 'seed-26',
    title: 'Turkey Burger',
    description: 'Juicy turkey burger on a whole grain bun with fresh toppings',
    servings: 4,
    prep_time: 10,
    cook_time: 12,
    total_time: 22,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 380, protein_g: 32, carbs_g: 28, fat_g: 16, fiber_g: 3, sodium_mg: 520 },
    ingredients: [
      { name: 'Ground turkey', quantity: 1, unit: 'lb', normalized_name: 'ground turkey', aisle: 'Meat', order_index: 0 },
      { name: 'Whole grain buns', quantity: 4, unit: 'buns', normalized_name: 'hamburger buns', aisle: 'Bakery', order_index: 1 },
      { name: 'Lettuce', quantity: 4, unit: 'leaves', normalized_name: 'lettuce', aisle: 'Produce', order_index: 2 },
      { name: 'Tomato', quantity: 1, unit: 'medium', normalized_name: 'tomato', aisle: 'Produce', order_index: 3 },
      { name: 'Red onion', quantity: 0.25, unit: 'whole', normalized_name: 'red onion', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Form turkey into 4 patties and season.' },
      { step_number: 2, instruction: 'Grill or pan-fry for 5-6 minutes per side.' },
      { step_number: 3, instruction: 'Toast buns and assemble burgers with toppings.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'protein', tag_value: 'turkey' },
    ],
  },
  {
    id: 'seed-27',
    title: 'Zucchini Noodles with Pesto',
    description: 'Light and healthy zucchini noodles tossed with fresh basil pesto',
    servings: 2,
    prep_time: 15,
    cook_time: 5,
    total_time: 20,
    cuisine: 'Italian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1556761223-4c4282c73f77?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    nutrition: { calories: 220, protein_g: 8, carbs_g: 12, fat_g: 18, fiber_g: 4, sodium_mg: 280 },
    ingredients: [
      { name: 'Zucchini', quantity: 3, unit: 'medium', normalized_name: 'zucchini', aisle: 'Produce', order_index: 0 },
      { name: 'Basil pesto', quantity: 0.25, unit: 'cup', normalized_name: 'pesto', aisle: 'Condiments', order_index: 1 },
      { name: 'Cherry tomatoes', quantity: 0.5, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 2 },
      { name: 'Parmesan', quantity: 2, unit: 'tbsp', normalized_name: 'parmesan', aisle: 'Dairy', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Spiralize zucchini into noodles.' },
      { step_number: 2, instruction: 'Lightly sauté or serve raw.' },
      { step_number: 3, instruction: 'Toss with pesto and tomatoes. Top with parmesan.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'lunch' },
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'diet', tag_value: 'keto' },
    ],
  },
  {
    id: 'seed-28',
    title: 'Banana Pancakes',
    description: 'Fluffy pancakes made with ripe bananas and a hint of cinnamon',
    servings: 2,
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 320, protein_g: 10, carbs_g: 48, fat_g: 10, fiber_g: 4, sodium_mg: 380 },
    ingredients: [
      { name: 'Ripe bananas', quantity: 2, unit: 'medium', normalized_name: 'bananas', aisle: 'Produce', order_index: 0 },
      { name: 'Eggs', quantity: 2, unit: 'large', normalized_name: 'eggs', aisle: 'Dairy', order_index: 1 },
      { name: 'Oat flour', quantity: 0.5, unit: 'cup', normalized_name: 'oat flour', aisle: 'Baking', order_index: 2 },
      { name: 'Cinnamon', quantity: 0.5, unit: 'tsp', normalized_name: 'cinnamon', aisle: 'Spices', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Mash bananas and mix with eggs.' },
      { step_number: 2, instruction: 'Stir in oat flour and cinnamon.' },
      { step_number: 3, instruction: 'Cook on a griddle until golden on both sides.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'breakfast' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
    ],
  },
  {
    id: 'seed-29',
    title: 'Roasted Chickpea Snack',
    description: 'Crunchy roasted chickpeas with savory seasonings',
    servings: 4,
    prep_time: 5,
    cook_time: 30,
    total_time: 35,
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 180, protein_g: 8, carbs_g: 28, fat_g: 4, fiber_g: 8, sodium_mg: 320 },
    ingredients: [
      { name: 'Chickpeas', quantity: 2, unit: 'cans', normalized_name: 'chickpeas', aisle: 'Canned Goods', order_index: 0 },
      { name: 'Olive oil', quantity: 1, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 1 },
      { name: 'Paprika', quantity: 1, unit: 'tsp', normalized_name: 'paprika', aisle: 'Spices', order_index: 2 },
      { name: 'Garlic powder', quantity: 0.5, unit: 'tsp', normalized_name: 'garlic powder', aisle: 'Spices', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Drain and dry chickpeas thoroughly.' },
      { step_number: 2, instruction: 'Toss with olive oil and seasonings.' },
      { step_number: 3, instruction: 'Roast at 400°F for 30 minutes, shaking halfway.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-30',
    title: 'Energy Balls',
    description: 'No-bake energy balls with oats, peanut butter, and chocolate',
    servings: 12,
    prep_time: 15,
    cook_time: 0,
    total_time: 15,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    nutrition: { calories: 140, protein_g: 4, carbs_g: 18, fat_g: 6, fiber_g: 2, sodium_mg: 45 },
    ingredients: [
      { name: 'Rolled oats', quantity: 1, unit: 'cup', normalized_name: 'oats', aisle: 'Breakfast', order_index: 0 },
      { name: 'Peanut butter', quantity: 0.5, unit: 'cup', normalized_name: 'peanut butter', aisle: 'Spreads', order_index: 1 },
      { name: 'Honey', quantity: 0.25, unit: 'cup', normalized_name: 'honey', aisle: 'Baking', order_index: 2 },
      { name: 'Mini chocolate chips', quantity: 0.25, unit: 'cup', normalized_name: 'chocolate chips', aisle: 'Baking', order_index: 3 },
    ],
    steps: [
      { step_number: 1, instruction: 'Mix all ingredients in a bowl.' },
      { step_number: 2, instruction: 'Roll into small balls.' },
      { step_number: 3, instruction: 'Refrigerate for 30 minutes before serving.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegetarian' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

    // Use service role for database operations (no auth required for seeding)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting to seed ${seedRecipes.length} global recipes...`);

    let successCount = 0;
    
    for (const recipe of seedRecipes) {
      try {
        // Check if recipe already exists
        const { data: existing } = await supabase
          .from('recipes')
          .select('id')
          .eq('title', recipe.title)
          .eq('scope', 'global')
          .maybeSingle();

        if (existing) {
          console.log(`Recipe already exists: ${recipe.title}`);
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
        
        const imageUrl = generatedImage || recipe.image_url;
        
        // Insert recipe (let database generate UUID)
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            title: recipe.title,
            description: recipe.description,
            servings: recipe.servings,
            serving_size: servingSize,
            prep_time: recipe.prep_time,
            cook_time: recipe.cook_time,
            total_time: recipe.total_time,
            cuisine: recipe.cuisine,
            difficulty: recipe.difficulty,
            image_url: imageUrl,
            is_kid_friendly: recipe.is_kid_friendly,
            is_meal_prep_friendly: recipe.is_meal_prep_friendly,
            is_budget_friendly: recipe.is_budget_friendly,
            scope: 'global',
            owner_user_id: null,
          })
          .select()
          .single();

        if (recipeError) {
          console.error(`Error inserting recipe ${recipe.title}:`, recipeError);
          continue;
        }

        const recipeId = recipeData.id;

        // Insert nutrition
        await supabase.from('recipe_nutrition').insert({
          recipe_id: recipeId,
          ...recipe.nutrition,
        });

        // Insert ingredients
        for (const ingredient of recipe.ingredients) {
          await supabase.from('recipe_ingredients').insert({
            recipe_id: recipeId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            normalized_name: ingredient.normalized_name,
            aisle: ingredient.aisle,
            order_index: ingredient.order_index,
          });
        }

        // Insert steps
        for (const step of recipe.steps) {
          await supabase.from('recipe_steps').insert({
            recipe_id: recipeId,
            step_number: step.step_number,
            instruction: step.instruction,
          });
        }

        // Insert tags
        for (const tag of recipe.tags) {
          await supabase.from('recipe_tags').insert({
            recipe_id: recipeId,
            tag_type: tag.tag_type,
            tag_value: tag.tag_value,
          });
        }

        successCount++;
        console.log(`Seeded recipe: ${recipe.title}`);
      } catch (err) {
        console.error(`Failed to seed recipe ${recipe.title}:`, err);
      }
    }

    console.log(`Successfully seeded ${successCount} recipes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Seeded ${successCount} global recipes`,
        count: successCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error seeding recipes:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
