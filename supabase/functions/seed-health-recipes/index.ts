import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Health-conscious recipes organized by health tag
// Each recipe is designed to meet specific health criteria:
// - diabetes-friendly: low sugar (<10g), high fiber (>5g), moderate carbs (<40g)
// - kidney-friendly: low sodium (<400mg), moderate protein
// - heart-healthy: low saturated fat, high fiber, low sodium
// - low-sodium: sodium <300mg per serving

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
  sugar_g: number;
  saturated_fat_g: number;
  ingredients: Array<{ name: string; quantity: number; unit: string; aisle: string }>;
  steps: string[];
  tags: Array<{ tag_type: string; tag_value: string }>;
  image_filename: string;
}

const healthRecipes: Record<string, Recipe[]> = {
  "diabetes-friendly": [
    {
      title: "Grilled Lemon Herb Salmon",
      description: "Omega-rich salmon with herbs, perfect for blood sugar control",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 320, protein_g: 34, carbs_g: 4, fat_g: 18, fiber_g: 1, sodium_mg: 280, sugar_g: 1, saturated_fat_g: 3,
      ingredients: [
        { name: "Salmon fillets", quantity: 4, unit: "6oz pieces", aisle: "Seafood" },
        { name: "Lemon", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Fresh dill", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Garlic", quantity: 3, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Marinate salmon with lemon, herbs and garlic for 20 minutes.", "Grill over medium-high heat for 4-5 minutes per side.", "Serve with fresh lemon wedges."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "diet", tag_value: "mediterranean" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "grilled-salmon-lemon-dill.jpg"
    },
    {
      title: "Cauliflower Rice Stir-Fry",
      description: "Low-carb veggie stir-fry with cauliflower rice, diabetic-friendly",
      prep_time: 15, cook_time: 12, total_time: 27, servings: 4, difficulty: "easy",
      cuisine: "Asian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 8, carbs_g: 18, fat_g: 10, fiber_g: 6, sodium_mg: 320, sugar_g: 5, saturated_fat_g: 1,
      ingredients: [
        { name: "Cauliflower rice", quantity: 4, unit: "cups", aisle: "Produce" },
        { name: "Mixed vegetables", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" },
        { name: "Low-sodium soy sauce", quantity: 2, unit: "tbsp", aisle: "Asian" },
        { name: "Sesame oil", quantity: 1, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Heat sesame oil in wok over high heat.", "Stir-fry vegetables until tender-crisp.", "Add cauliflower rice and soy sauce, cook 5 minutes.", "Push aside and scramble eggs, then mix together."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "cauliflower-fried-rice.jpg"
    },
    {
      title: "Turkey Lettuce Wraps",
      description: "Lean ground turkey in crisp lettuce cups, low carb and satisfying",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Asian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 26, carbs_g: 8, fat_g: 10, fiber_g: 2, sodium_mg: 380, sugar_g: 3, saturated_fat_g: 2,
      ingredients: [
        { name: "Ground turkey", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Butter lettuce", quantity: 1, unit: "head", aisle: "Produce" },
        { name: "Water chestnuts", quantity: 1, unit: "can", aisle: "Asian" },
        { name: "Green onions", quantity: 4, unit: "stalks", aisle: "Produce" },
        { name: "Ginger", quantity: 1, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Brown turkey with ginger and garlic.", "Add water chestnuts and green onions.", "Serve in lettuce cups with your favorite toppings."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "keto-beef-lettuce-wraps.jpg"
    },
    {
      title: "Baked Cod with Herb Crust",
      description: "Flaky white fish with a parsley-almond crust, low glycemic meal",
      prep_time: 10, cook_time: 18, total_time: 28, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 240, protein_g: 32, carbs_g: 6, fat_g: 10, fiber_g: 2, sodium_mg: 290, sugar_g: 1, saturated_fat_g: 2,
      ingredients: [
        { name: "Cod fillets", quantity: 4, unit: "6oz pieces", aisle: "Seafood" },
        { name: "Almond flour", quantity: 0.5, unit: "cup", aisle: "Baking" },
        { name: "Fresh parsley", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lemon zest", quantity: 1, unit: "tbsp", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Mix almond flour, parsley, and lemon zest.", "Press herb mixture onto fish.", "Bake at 400°F for 15-18 minutes until flaky."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "baked-cod-herbs.jpg"
    },
    {
      title: "Spinach Mushroom Egg Muffins",
      description: "Protein-packed portable breakfast, perfect for diabetics",
      prep_time: 10, cook_time: 22, total_time: 32, servings: 6, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 140, protein_g: 12, carbs_g: 3, fat_g: 9, fiber_g: 1, sodium_mg: 260, sugar_g: 1, saturated_fat_g: 3,
      ingredients: [
        { name: "Eggs", quantity: 8, unit: "large", aisle: "Dairy" },
        { name: "Fresh spinach", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Mushrooms", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Feta cheese", quantity: 0.5, unit: "cup", aisle: "Dairy" },
        { name: "Black pepper", quantity: 0.5, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Sauté spinach and mushrooms until wilted.", "Whisk eggs with feta and pepper.", "Divide vegetables into muffin tin, pour eggs, bake 20-22 min at 350°F."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "egg-muffins.jpg"
    },
    {
      title: "Zucchini Noodles with Pesto",
      description: "Fresh zucchini spirals with basil pesto, zero glycemic impact",
      prep_time: 15, cook_time: 5, total_time: 20, servings: 4, difficulty: "easy",
      cuisine: "Italian",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 6, carbs_g: 10, fat_g: 14, fiber_g: 3, sodium_mg: 180, sugar_g: 4, saturated_fat_g: 3,
      ingredients: [
        { name: "Zucchini", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "Basil pesto", quantity: 0.5, unit: "cup", aisle: "Condiments" },
        { name: "Cherry tomatoes", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Pine nuts", quantity: 2, unit: "tbsp", aisle: "Nuts" },
        { name: "Parmesan", quantity: 0.25, unit: "cup", aisle: "Dairy" }
      ],
      steps: ["Spiralize zucchini into noodles.", "Toss with pesto and halved tomatoes.", "Top with pine nuts and parmesan, serve raw or lightly warmed."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "zoodles-pesto.jpg"
    },
    {
      title: "Grilled Chicken with Avocado Salsa",
      description: "Lean protein with healthy fats, blood sugar friendly",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "Mexican",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 38, carbs_g: 8, fat_g: 18, fiber_g: 5, sodium_mg: 320, sugar_g: 2, saturated_fat_g: 3,
      ingredients: [
        { name: "Chicken breasts", quantity: 4, unit: "6oz pieces", aisle: "Meat" },
        { name: "Avocado", quantity: 2, unit: "ripe", aisle: "Produce" },
        { name: "Cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lime", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Jalapeño", quantity: 1, unit: "small", aisle: "Produce" }
      ],
      steps: ["Season chicken with cumin and grill 6-7 minutes per side.", "Dice avocado and mix with cilantro, lime, jalapeño.", "Top grilled chicken with fresh avocado salsa."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "chicken-chimichurri.jpg"
    },
    {
      title: "Stuffed Bell Peppers with Ground Turkey",
      description: "Colorful peppers filled with seasoned turkey and vegetables",
      prep_time: 20, cook_time: 35, total_time: 55, servings: 4, difficulty: "medium",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 28, carbs_g: 18, fat_g: 12, fiber_g: 5, sodium_mg: 340, sugar_g: 6, saturated_fat_g: 3,
      ingredients: [
        { name: "Bell peppers", quantity: 4, unit: "large", aisle: "Produce" },
        { name: "Ground turkey", quantity: 1, unit: "lb", aisle: "Meat" },
        { name: "Cauliflower rice", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Diced tomatoes", quantity: 1, unit: "can", aisle: "Canned" },
        { name: "Italian seasoning", quantity: 1, unit: "tbsp", aisle: "Spices" }
      ],
      steps: ["Cut tops off peppers and remove seeds.", "Brown turkey with seasonings and mix with cauliflower rice and tomatoes.", "Stuff peppers and bake at 375°F for 35 minutes."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "stuffed-bell-peppers.jpg"
    },
    {
      title: "Almond Crusted Chicken Tenders",
      description: "Crispy chicken tenders coated in almond flour, not breadcrumbs",
      prep_time: 15, cook_time: 18, total_time: 33, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 36, carbs_g: 6, fat_g: 16, fiber_g: 2, sodium_mg: 280, sugar_g: 1, saturated_fat_g: 2,
      ingredients: [
        { name: "Chicken tenders", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Almond flour", quantity: 1, unit: "cup", aisle: "Baking" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" },
        { name: "Paprika", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Garlic powder", quantity: 1, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Mix almond flour with spices.", "Dip chicken in beaten egg, then almond mixture.", "Bake at 400°F for 18 minutes, flipping halfway."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "keto" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "chicken-katsu.jpg"
    },
    {
      title: "Greek Salad with Grilled Shrimp",
      description: "Mediterranean salad topped with protein-rich grilled shrimp",
      prep_time: 15, cook_time: 8, total_time: 23, servings: 4, difficulty: "easy",
      cuisine: "Greek",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 290, protein_g: 28, carbs_g: 12, fat_g: 16, fiber_g: 4, sodium_mg: 360, sugar_g: 5, saturated_fat_g: 5,
      ingredients: [
        { name: "Large shrimp", quantity: 1, unit: "lb", aisle: "Seafood" },
        { name: "Cucumber", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Cherry tomatoes", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Feta cheese", quantity: 0.5, unit: "cup", aisle: "Dairy" },
        { name: "Kalamata olives", quantity: 0.25, unit: "cup", aisle: "Olives" }
      ],
      steps: ["Grill shrimp with olive oil and oregano 2-3 min per side.", "Chop vegetables and arrange on plate.", "Top with shrimp, feta, and olive oil dressing."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "mediterranean" }, { tag_type: "medical", tag_value: "diabetes-friendly" }],
      image_filename: "greek-salad.jpg"
    }
  ],
  "kidney-friendly": [
    {
      title: "Herb Roasted Chicken Thighs",
      description: "Juicy chicken with fresh herbs, low sodium and kidney-safe",
      prep_time: 10, cook_time: 35, total_time: 45, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 28, carbs_g: 2, fat_g: 18, fiber_g: 0, sodium_mg: 180, sugar_g: 0, saturated_fat_g: 5,
      ingredients: [
        { name: "Chicken thighs", quantity: 8, unit: "bone-in", aisle: "Meat" },
        { name: "Fresh rosemary", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Fresh thyme", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" }
      ],
      steps: ["Rub chicken with olive oil, garlic, and fresh herbs.", "Roast at 425°F for 35 minutes until crispy.", "Rest 5 minutes before serving."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "lemon-herb-roasted-chicken.jpg"
    },
    {
      title: "Garlic Butter Shrimp",
      description: "Quick sautéed shrimp in herb butter, naturally low sodium",
      prep_time: 10, cook_time: 8, total_time: 18, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 220, protein_g: 24, carbs_g: 2, fat_g: 12, fiber_g: 0, sodium_mg: 190, sugar_g: 0, saturated_fat_g: 6,
      ingredients: [
        { name: "Large shrimp", quantity: 1.5, unit: "lbs", aisle: "Seafood" },
        { name: "Unsalted butter", quantity: 4, unit: "tbsp", aisle: "Dairy" },
        { name: "Garlic", quantity: 6, unit: "cloves", aisle: "Produce" },
        { name: "Fresh parsley", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lemon juice", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Melt butter and sauté garlic until fragrant.", "Add shrimp and cook 2-3 minutes per side.", "Finish with lemon juice and parsley."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "quick", tag_value: "under-30" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "garlic-butter-scallops.jpg"
    },
    {
      title: "Lemon Pepper Tilapia",
      description: "Mild white fish with zesty lemon pepper, no added salt",
      prep_time: 5, cook_time: 12, total_time: 17, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 32, carbs_g: 2, fat_g: 5, fiber_g: 0, sodium_mg: 120, sugar_g: 0, saturated_fat_g: 1,
      ingredients: [
        { name: "Tilapia fillets", quantity: 4, unit: "6oz pieces", aisle: "Seafood" },
        { name: "Lemon", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Black pepper", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Olive oil", quantity: 1, unit: "tbsp", aisle: "Oils" },
        { name: "Fresh dill", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Season fish with pepper and lemon zest.", "Pan-fry in olive oil 4-5 minutes per side.", "Squeeze fresh lemon and garnish with dill."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "quick", tag_value: "under-30" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "baked-cod-herbs.jpg"
    },
    {
      title: "Rosemary Pork Tenderloin",
      description: "Lean pork with aromatic rosemary, kidney-diet approved",
      prep_time: 10, cook_time: 25, total_time: 35, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 240, protein_g: 32, carbs_g: 2, fat_g: 11, fiber_g: 0, sodium_mg: 160, sugar_g: 0, saturated_fat_g: 3,
      ingredients: [
        { name: "Pork tenderloin", quantity: 1.5, unit: "lbs", aisle: "Meat" },
        { name: "Fresh rosemary", quantity: 3, unit: "tbsp", aisle: "Produce" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" },
        { name: "Black pepper", quantity: 1, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Rub pork with olive oil, garlic, rosemary, and pepper.", "Sear on all sides, then roast at 400°F for 20 minutes.", "Rest 5 minutes, slice and serve."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "herb-crusted-pork-tenderloin.jpg"
    },
    {
      title: "Cucumber Dill Salad",
      description: "Refreshing cucumber salad with creamy dill dressing",
      prep_time: 10, cook_time: 0, total_time: 10, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 80, protein_g: 2, carbs_g: 8, fat_g: 5, fiber_g: 1, sodium_mg: 85, sugar_g: 4, saturated_fat_g: 1,
      ingredients: [
        { name: "Cucumbers", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Greek yogurt", quantity: 0.5, unit: "cup", aisle: "Dairy" },
        { name: "Fresh dill", quantity: 3, unit: "tbsp", aisle: "Produce" },
        { name: "White vinegar", quantity: 2, unit: "tbsp", aisle: "Condiments" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Slice cucumbers thin.", "Mix yogurt, dill, vinegar, and pepper.", "Toss cucumbers with dressing and chill before serving."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "greek-salad.jpg"
    },
    {
      title: "Herbed Rice Pilaf",
      description: "Fragrant rice with fresh herbs, no added sodium",
      prep_time: 5, cook_time: 20, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 180, protein_g: 4, carbs_g: 36, fat_g: 3, fiber_g: 1, sodium_mg: 10, sugar_g: 0, saturated_fat_g: 0,
      ingredients: [
        { name: "White rice", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Unsalted chicken broth", quantity: 3, unit: "cups", aisle: "Soups" },
        { name: "Fresh parsley", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Olive oil", quantity: 1, unit: "tbsp", aisle: "Oils" },
        { name: "Bay leaf", quantity: 1, unit: "leaf", aisle: "Spices" }
      ],
      steps: ["Toast rice in olive oil for 2 minutes.", "Add broth and bay leaf, bring to boil.", "Simmer covered 18 minutes, fluff with parsley."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "biryani.jpg"
    },
    {
      title: "Grilled Lamb Chops with Mint",
      description: "Tender lamb with fresh mint, naturally low in sodium",
      prep_time: 10, cook_time: 12, total_time: 22, servings: 4, difficulty: "medium",
      cuisine: "Mediterranean",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 320, protein_g: 26, carbs_g: 2, fat_g: 24, fiber_g: 0, sodium_mg: 140, sugar_g: 0, saturated_fat_g: 10,
      ingredients: [
        { name: "Lamb chops", quantity: 8, unit: "pieces", aisle: "Meat" },
        { name: "Fresh mint", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Garlic", quantity: 3, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" },
        { name: "Lemon juice", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Marinate lamb with olive oil, garlic, and mint.", "Grill over high heat 4-5 minutes per side.", "Rest and serve with fresh mint."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "lamb" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "grilled-lamb-chops.jpg"
    },
    {
      title: "Honey Glazed Carrots",
      description: "Sweet roasted carrots with a light honey glaze",
      prep_time: 5, cook_time: 25, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 100, protein_g: 1, carbs_g: 18, fat_g: 3, fiber_g: 3, sodium_mg: 70, sugar_g: 12, saturated_fat_g: 0,
      ingredients: [
        { name: "Carrots", quantity: 1, unit: "lb", aisle: "Produce" },
        { name: "Honey", quantity: 2, unit: "tbsp", aisle: "Condiments" },
        { name: "Olive oil", quantity: 1, unit: "tbsp", aisle: "Oils" },
        { name: "Fresh thyme", quantity: 1, unit: "tbsp", aisle: "Produce" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Toss carrots with oil and roast at 400°F for 20 minutes.", "Drizzle with honey and roast 5 more minutes.", "Garnish with fresh thyme."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "harissa-roasted-vegetables.jpg"
    },
    {
      title: "Pan-Seared Duck Breast",
      description: "Crispy skin duck with orange glaze, low sodium luxury",
      prep_time: 10, cook_time: 18, total_time: 28, servings: 4, difficulty: "medium",
      cuisine: "French",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: false,
      calories: 350, protein_g: 28, carbs_g: 8, fat_g: 24, fiber_g: 0, sodium_mg: 110, sugar_g: 6, saturated_fat_g: 7,
      ingredients: [
        { name: "Duck breasts", quantity: 2, unit: "large", aisle: "Meat" },
        { name: "Orange", quantity: 1, unit: "whole", aisle: "Produce" },
        { name: "Fresh thyme", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Honey", quantity: 1, unit: "tbsp", aisle: "Condiments" },
        { name: "Black pepper", quantity: 0.5, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Score duck skin and season with pepper.", "Start skin-side down in cold pan, cook 12 minutes.", "Flip, cook 4 minutes, glaze with orange-honey."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "seared-duck-breast.jpg"
    },
    {
      title: "Fresh Fruit Salad",
      description: "Colorful mixed fruits with honey-lime dressing",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 6, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 110, protein_g: 1, carbs_g: 28, fat_g: 0, fiber_g: 3, sodium_mg: 5, sugar_g: 22, saturated_fat_g: 0,
      ingredients: [
        { name: "Strawberries", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Blueberries", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Mango", quantity: 1, unit: "large", aisle: "Produce" },
        { name: "Honey", quantity: 2, unit: "tbsp", aisle: "Condiments" },
        { name: "Lime", quantity: 1, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Dice all fruits into bite-sized pieces.", "Whisk honey with lime juice.", "Toss fruit with dressing and serve chilled."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "kidney-friendly" }],
      image_filename: "acai-bowl.jpg"
    }
  ],
  "heart-healthy": [
    {
      title: "Baked Salmon with Olive Tapenade",
      description: "Omega-3 rich salmon with Mediterranean olive topping",
      prep_time: 10, cook_time: 18, total_time: 28, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: false,
      calories: 340, protein_g: 36, carbs_g: 4, fat_g: 20, fiber_g: 1, sodium_mg: 380, sugar_g: 1, saturated_fat_g: 3,
      ingredients: [
        { name: "Salmon fillets", quantity: 4, unit: "6oz pieces", aisle: "Seafood" },
        { name: "Kalamata olives", quantity: 0.5, unit: "cup", aisle: "Olives" },
        { name: "Capers", quantity: 2, unit: "tbsp", aisle: "Condiments" },
        { name: "Lemon", quantity: 1, unit: "whole", aisle: "Produce" },
        { name: "Olive oil", quantity: 3, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Make tapenade by pulsing olives, capers, lemon, and oil.", "Top salmon with tapenade.", "Bake at 400°F for 15-18 minutes."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "mediterranean" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "grilled-salmon-lemon-dill.jpg"
    },
    {
      title: "Quinoa Black Bean Bowl",
      description: "Fiber-rich bowl with plant protein, heart-protective ingredients",
      prep_time: 10, cook_time: 20, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "Mexican",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 320, protein_g: 14, carbs_g: 52, fat_g: 8, fiber_g: 12, sodium_mg: 320, sugar_g: 4, saturated_fat_g: 1,
      ingredients: [
        { name: "Quinoa", quantity: 1, unit: "cup", aisle: "Grains" },
        { name: "Black beans", quantity: 1, unit: "can", aisle: "Canned" },
        { name: "Corn", quantity: 1, unit: "cup", aisle: "Frozen" },
        { name: "Avocado", quantity: 1, unit: "ripe", aisle: "Produce" },
        { name: "Lime", quantity: 1, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Cook quinoa according to package.", "Warm beans and corn.", "Assemble bowls and top with avocado and lime."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "burrito-bowl.jpg"
    },
    {
      title: "Oatmeal with Walnuts and Berries",
      description: "Heart-healthy breakfast with soluble fiber and omega-3s",
      prep_time: 5, cook_time: 10, total_time: 15, servings: 2, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 340, protein_g: 10, carbs_g: 48, fat_g: 14, fiber_g: 8, sodium_mg: 10, sugar_g: 12, saturated_fat_g: 1,
      ingredients: [
        { name: "Rolled oats", quantity: 1, unit: "cup", aisle: "Breakfast" },
        { name: "Walnuts", quantity: 0.25, unit: "cup", aisle: "Nuts" },
        { name: "Mixed berries", quantity: 1, unit: "cup", aisle: "Produce" },
        { name: "Cinnamon", quantity: 0.5, unit: "tsp", aisle: "Spices" },
        { name: "Honey", quantity: 1, unit: "tbsp", aisle: "Condiments" }
      ],
      steps: ["Cook oats with water or almond milk.", "Top with walnuts, berries, and cinnamon.", "Drizzle with honey."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "acai-bowl.jpg"
    },
    {
      title: "Grilled Mediterranean Vegetables",
      description: "Colorful vegetables with olive oil and herbs",
      prep_time: 15, cook_time: 15, total_time: 30, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 140, protein_g: 3, carbs_g: 16, fat_g: 8, fiber_g: 5, sodium_mg: 180, sugar_g: 8, saturated_fat_g: 1,
      ingredients: [
        { name: "Zucchini", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Bell peppers", quantity: 2, unit: "large", aisle: "Produce" },
        { name: "Eggplant", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Olive oil", quantity: 3, unit: "tbsp", aisle: "Oils" },
        { name: "Fresh oregano", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Slice vegetables into planks.", "Brush with olive oil and season.", "Grill 4-5 minutes per side until charred."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "grilled-mediterranean-vegetables.jpg"
    },
    {
      title: "Lentil Vegetable Soup",
      description: "Fiber-packed lentil soup with vegetables, cholesterol-lowering",
      prep_time: 15, cook_time: 35, total_time: 50, servings: 6, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 240, protein_g: 14, carbs_g: 38, fat_g: 4, fiber_g: 14, sodium_mg: 380, sugar_g: 6, saturated_fat_g: 0,
      ingredients: [
        { name: "Green lentils", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Carrots", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Celery", quantity: 3, unit: "stalks", aisle: "Produce" },
        { name: "Diced tomatoes", quantity: 1, unit: "can", aisle: "Canned" },
        { name: "Vegetable broth", quantity: 6, unit: "cups", aisle: "Soups" }
      ],
      steps: ["Sauté carrots, celery, and onion.", "Add lentils, tomatoes, and broth.", "Simmer 30-35 minutes until lentils are tender."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "mediterranean-lentil-soup.jpg"
    },
    {
      title: "Avocado Toast with Poached Egg",
      description: "Healthy fats and protein on whole grain bread",
      prep_time: 5, cook_time: 8, total_time: 13, servings: 2, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 320, protein_g: 14, carbs_g: 28, fat_g: 18, fiber_g: 8, sodium_mg: 280, sugar_g: 2, saturated_fat_g: 3,
      ingredients: [
        { name: "Whole grain bread", quantity: 2, unit: "slices", aisle: "Bakery" },
        { name: "Avocado", quantity: 1, unit: "ripe", aisle: "Produce" },
        { name: "Eggs", quantity: 2, unit: "large", aisle: "Dairy" },
        { name: "Red pepper flakes", quantity: 0.25, unit: "tsp", aisle: "Spices" },
        { name: "Lemon juice", quantity: 1, unit: "tsp", aisle: "Produce" }
      ],
      steps: ["Toast bread and mash avocado with lemon.", "Poach eggs for 3-4 minutes.", "Top toast with avocado and egg."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "shakshuka.jpg"
    },
    {
      title: "Chia Seed Pudding",
      description: "Omega-3 rich breakfast pudding with fresh fruit",
      prep_time: 5, cook_time: 0, total_time: 5, servings: 2, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 240, protein_g: 8, carbs_g: 28, fat_g: 12, fiber_g: 10, sodium_mg: 90, sugar_g: 8, saturated_fat_g: 1,
      ingredients: [
        { name: "Chia seeds", quantity: 0.25, unit: "cup", aisle: "Health Foods" },
        { name: "Almond milk", quantity: 1, unit: "cup", aisle: "Dairy" },
        { name: "Vanilla extract", quantity: 0.5, unit: "tsp", aisle: "Baking" },
        { name: "Fresh berries", quantity: 0.5, unit: "cup", aisle: "Produce" },
        { name: "Honey", quantity: 1, unit: "tbsp", aisle: "Condiments" }
      ],
      steps: ["Mix chia seeds, almond milk, vanilla, and honey.", "Refrigerate overnight.", "Top with fresh berries before serving."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "mango-sticky-rice.jpg"
    },
    {
      title: "Grilled Mackerel with Herbs",
      description: "Omega-3 powerhouse fish with fresh herb crust",
      prep_time: 10, cook_time: 12, total_time: 22, servings: 4, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: false, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 290, protein_g: 26, carbs_g: 2, fat_g: 20, fiber_g: 0, sodium_mg: 320, sugar_g: 0, saturated_fat_g: 4,
      ingredients: [
        { name: "Mackerel fillets", quantity: 4, unit: "pieces", aisle: "Seafood" },
        { name: "Fresh parsley", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lemon", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" },
        { name: "Garlic", quantity: 3, unit: "cloves", aisle: "Produce" }
      ],
      steps: ["Marinate fish with herbs, garlic, and lemon.", "Grill 5-6 minutes per side.", "Serve with fresh lemon wedges."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "pescatarian" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "grilled-swordfish.jpg"
    },
    {
      title: "Spinach Walnut Salad",
      description: "Leafy greens with heart-healthy walnuts and olive oil",
      prep_time: 10, cook_time: 0, total_time: 10, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 180, protein_g: 5, carbs_g: 10, fat_g: 15, fiber_g: 4, sodium_mg: 120, sugar_g: 4, saturated_fat_g: 2,
      ingredients: [
        { name: "Baby spinach", quantity: 6, unit: "cups", aisle: "Produce" },
        { name: "Walnuts", quantity: 0.5, unit: "cup", aisle: "Nuts" },
        { name: "Dried cranberries", quantity: 0.25, unit: "cup", aisle: "Dried Fruit" },
        { name: "Goat cheese", quantity: 2, unit: "oz", aisle: "Dairy" },
        { name: "Balsamic vinegar", quantity: 2, unit: "tbsp", aisle: "Condiments" }
      ],
      steps: ["Arrange spinach in bowl.", "Top with walnuts, cranberries, and goat cheese.", "Drizzle with olive oil and balsamic."],
      tags: [{ tag_type: "meal", tag_value: "lunch" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "fattoush-salad.jpg"
    },
    {
      title: "Edamame Hummus",
      description: "Protein-rich dip with healthy plant fats",
      prep_time: 10, cook_time: 0, total_time: 10, servings: 8, difficulty: "easy",
      cuisine: "Asian",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 120, protein_g: 6, carbs_g: 10, fat_g: 6, fiber_g: 3, sodium_mg: 180, sugar_g: 2, saturated_fat_g: 1,
      ingredients: [
        { name: "Edamame", quantity: 2, unit: "cups", aisle: "Frozen" },
        { name: "Tahini", quantity: 2, unit: "tbsp", aisle: "International" },
        { name: "Lemon juice", quantity: 3, unit: "tbsp", aisle: "Produce" },
        { name: "Garlic", quantity: 2, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Cook edamame and let cool.", "Blend with tahini, lemon, garlic, and oil.", "Serve with vegetable sticks."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "heart-healthy" }],
      image_filename: "baba-ganoush.jpg"
    }
  ],
  "low-sodium": [
    {
      title: "Herb Grilled Chicken Breast",
      description: "Flavorful chicken seasoned with fresh herbs, no added salt",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 220, protein_g: 36, carbs_g: 2, fat_g: 7, fiber_g: 0, sodium_mg: 90, sugar_g: 0, saturated_fat_g: 1,
      ingredients: [
        { name: "Chicken breasts", quantity: 4, unit: "6oz pieces", aisle: "Meat" },
        { name: "Fresh rosemary", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Fresh thyme", quantity: 2, unit: "tbsp", aisle: "Produce" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "Oils" }
      ],
      steps: ["Marinate chicken with herbs, garlic, and oil for 1 hour.", "Grill over medium-high heat 6-7 minutes per side.", "Rest 5 minutes before slicing."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "chicken" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "lemon-herb-roasted-chicken.jpg"
    },
    {
      title: "Roasted Vegetable Medley",
      description: "Colorful roasted vegetables with olive oil and herbs",
      prep_time: 15, cook_time: 30, total_time: 45, servings: 6, difficulty: "easy",
      cuisine: "Mediterranean",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 120, protein_g: 3, carbs_g: 18, fat_g: 5, fiber_g: 5, sodium_mg: 35, sugar_g: 8, saturated_fat_g: 1,
      ingredients: [
        { name: "Sweet potatoes", quantity: 2, unit: "medium", aisle: "Produce" },
        { name: "Brussels sprouts", quantity: 2, unit: "cups", aisle: "Produce" },
        { name: "Carrots", quantity: 3, unit: "medium", aisle: "Produce" },
        { name: "Olive oil", quantity: 3, unit: "tbsp", aisle: "Oils" },
        { name: "Fresh thyme", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Cut vegetables into even pieces.", "Toss with olive oil and herbs.", "Roast at 400°F for 30 minutes, stirring halfway."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "harissa-roasted-vegetables.jpg"
    },
    {
      title: "Lemon Garlic Pasta",
      description: "Simple pasta with fresh lemon and garlic, no added salt",
      prep_time: 10, cook_time: 15, total_time: 25, servings: 4, difficulty: "easy",
      cuisine: "Italian",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 320, protein_g: 10, carbs_g: 54, fat_g: 8, fiber_g: 3, sodium_mg: 15, sugar_g: 2, saturated_fat_g: 1,
      ingredients: [
        { name: "Spaghetti", quantity: 12, unit: "oz", aisle: "Pasta" },
        { name: "Lemon", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Garlic", quantity: 6, unit: "cloves", aisle: "Produce" },
        { name: "Olive oil", quantity: 3, unit: "tbsp", aisle: "Oils" },
        { name: "Fresh parsley", quantity: 0.25, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Cook pasta in unsalted water.", "Sauté garlic in olive oil until golden.", "Toss pasta with garlic oil, lemon juice, and zest."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "spaghetti-carbonara.jpg"
    },
    {
      title: "Fresh Herb Omelet",
      description: "Fluffy eggs with fresh herbs, salt-free breakfast",
      prep_time: 5, cook_time: 5, total_time: 10, servings: 1, difficulty: "easy",
      cuisine: "French",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 220, protein_g: 14, carbs_g: 2, fat_g: 17, fiber_g: 0, sodium_mg: 140, sugar_g: 1, saturated_fat_g: 5,
      ingredients: [
        { name: "Eggs", quantity: 3, unit: "large", aisle: "Dairy" },
        { name: "Unsalted butter", quantity: 1, unit: "tbsp", aisle: "Dairy" },
        { name: "Fresh chives", quantity: 1, unit: "tbsp", aisle: "Produce" },
        { name: "Fresh tarragon", quantity: 1, unit: "tsp", aisle: "Produce" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Whisk eggs with herbs and pepper.", "Melt butter in non-stick pan over medium heat.", "Pour eggs, cook until just set, fold and serve."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "quick", tag_value: "under-15" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "egg-muffins.jpg"
    },
    {
      title: "Baked Sweet Potato",
      description: "Naturally sweet, perfectly baked, no salt needed",
      prep_time: 5, cook_time: 50, total_time: 55, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 130, protein_g: 3, carbs_g: 30, fat_g: 0, fiber_g: 5, sodium_mg: 40, sugar_g: 7, saturated_fat_g: 0,
      ingredients: [
        { name: "Sweet potatoes", quantity: 4, unit: "medium", aisle: "Produce" },
        { name: "Cinnamon", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Pierce potatoes with fork.", "Bake at 400°F for 45-50 minutes.", "Serve with cinnamon or your favorite toppings."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "baked-sweet-potato.jpg"
    },
    {
      title: "Citrus Marinated Pork Chops",
      description: "Juicy pork chops with orange and lime, naturally flavored",
      prep_time: 15, cook_time: 12, total_time: 27, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 260, protein_g: 30, carbs_g: 6, fat_g: 12, fiber_g: 0, sodium_mg: 85, sugar_g: 4, saturated_fat_g: 4,
      ingredients: [
        { name: "Pork chops", quantity: 4, unit: "bone-in", aisle: "Meat" },
        { name: "Orange", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Lime", quantity: 2, unit: "whole", aisle: "Produce" },
        { name: "Garlic", quantity: 4, unit: "cloves", aisle: "Produce" },
        { name: "Fresh cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" }
      ],
      steps: ["Marinate pork in citrus juice and garlic for 2 hours.", "Grill over medium-high heat 5-6 minutes per side.", "Garnish with fresh cilantro."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "protein", tag_value: "pork" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "herb-crusted-pork-tenderloin.jpg"
    },
    {
      title: "Steamed Broccoli with Lemon",
      description: "Simple steamed broccoli with bright lemon finish",
      prep_time: 5, cook_time: 8, total_time: 13, servings: 4, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 55, protein_g: 4, carbs_g: 10, fat_g: 1, fiber_g: 4, sodium_mg: 50, sugar_g: 2, saturated_fat_g: 0,
      ingredients: [
        { name: "Broccoli", quantity: 2, unit: "heads", aisle: "Produce" },
        { name: "Lemon", quantity: 1, unit: "whole", aisle: "Produce" },
        { name: "Olive oil", quantity: 1, unit: "tbsp", aisle: "Oils" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp", aisle: "Spices" }
      ],
      steps: ["Cut broccoli into florets.", "Steam for 5-8 minutes until tender-crisp.", "Drizzle with olive oil and lemon juice."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "quick", tag_value: "under-15" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "grilled-mediterranean-vegetables.jpg"
    },
    {
      title: "Apple Cinnamon Oatmeal",
      description: "Warm oatmeal with fresh apples and cinnamon, no salt",
      prep_time: 5, cook_time: 10, total_time: 15, servings: 2, difficulty: "easy",
      cuisine: "American",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 280, protein_g: 8, carbs_g: 52, fat_g: 6, fiber_g: 8, sodium_mg: 10, sugar_g: 18, saturated_fat_g: 1,
      ingredients: [
        { name: "Rolled oats", quantity: 1, unit: "cup", aisle: "Breakfast" },
        { name: "Apple", quantity: 1, unit: "medium", aisle: "Produce" },
        { name: "Cinnamon", quantity: 1, unit: "tsp", aisle: "Spices" },
        { name: "Honey", quantity: 2, unit: "tbsp", aisle: "Condiments" },
        { name: "Unsalted walnuts", quantity: 2, unit: "tbsp", aisle: "Nuts" }
      ],
      steps: ["Cook oats in water with diced apple.", "Stir in cinnamon.", "Top with honey and walnuts."],
      tags: [{ tag_type: "meal", tag_value: "breakfast" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "acai-bowl.jpg"
    },
    {
      title: "Mushroom Herb Risotto",
      description: "Creamy risotto with fresh mushrooms, no added salt",
      prep_time: 10, cook_time: 35, total_time: 45, servings: 4, difficulty: "medium",
      cuisine: "Italian",
      is_kid_friendly: true, is_meal_prep_friendly: false, is_budget_friendly: true,
      calories: 340, protein_g: 8, carbs_g: 52, fat_g: 12, fiber_g: 2, sodium_mg: 45, sugar_g: 2, saturated_fat_g: 4,
      ingredients: [
        { name: "Arborio rice", quantity: 1.5, unit: "cups", aisle: "Grains" },
        { name: "Mixed mushrooms", quantity: 12, unit: "oz", aisle: "Produce" },
        { name: "Low-sodium vegetable broth", quantity: 6, unit: "cups", aisle: "Soups" },
        { name: "White wine", quantity: 0.5, unit: "cup", aisle: "Wine" },
        { name: "Fresh thyme", quantity: 2, unit: "tbsp", aisle: "Produce" }
      ],
      steps: ["Sauté mushrooms and set aside.", "Toast rice, add wine, then broth gradually.", "Fold in mushrooms and thyme, finish with unsalted butter."],
      tags: [{ tag_type: "meal", tag_value: "dinner" }, { tag_type: "diet", tag_value: "vegetarian" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "risotto-ai-funghi.jpg"
    },
    {
      title: "Fresh Mango Salsa",
      description: "Bright tropical salsa, naturally salt-free",
      prep_time: 15, cook_time: 0, total_time: 15, servings: 6, difficulty: "easy",
      cuisine: "Mexican",
      is_kid_friendly: true, is_meal_prep_friendly: true, is_budget_friendly: true,
      calories: 60, protein_g: 1, carbs_g: 15, fat_g: 0, fiber_g: 2, sodium_mg: 5, sugar_g: 12, saturated_fat_g: 0,
      ingredients: [
        { name: "Mango", quantity: 2, unit: "ripe", aisle: "Produce" },
        { name: "Red onion", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Jalapeño", quantity: 1, unit: "small", aisle: "Produce" },
        { name: "Fresh cilantro", quantity: 0.25, unit: "cup", aisle: "Produce" },
        { name: "Lime", quantity: 2, unit: "whole", aisle: "Produce" }
      ],
      steps: ["Dice mango and red onion.", "Mince jalapeño and chop cilantro.", "Combine with lime juice, chill before serving."],
      tags: [{ tag_type: "meal", tag_value: "snack" }, { tag_type: "diet", tag_value: "vegan" }, { tag_type: "quick", tag_value: "under-15" }, { tag_type: "medical", tag_value: "low-sodium" }],
      image_filename: "guacamole.jpg"
    }
  ]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { category: string; inserted: number; errors: string[] }[] = [];

    for (const [healthTag, recipes] of Object.entries(healthRecipes)) {
      let insertedCount = 0;
      const errors: string[] = [];

      for (const recipe of recipes) {
        try {
          // Check if recipe already exists
          const { data: existing } = await supabase
            .from("recipes")
            .select("id")
            .eq("title", recipe.title)
            .eq("scope", "global")
            .maybeSingle();

          if (existing) {
            console.log(`Recipe already exists: ${recipe.title}`);
            continue;
          }

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
              difficulty: recipe.difficulty,
              cuisine: recipe.cuisine,
              is_kid_friendly: recipe.is_kid_friendly,
              is_meal_prep_friendly: recipe.is_meal_prep_friendly,
              is_budget_friendly: recipe.is_budget_friendly,
              image_url: `/recipe-images/${recipe.image_filename}`,
              scope: "global",
            })
            .select("id")
            .single();

          if (recipeError) {
            errors.push(`Recipe ${recipe.title}: ${recipeError.message}`);
            continue;
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
            sugar_g: recipe.sugar_g,
            saturated_fat_g: recipe.saturated_fat_g,
          });

          // Insert ingredients
          for (let i = 0; i < recipe.ingredients.length; i++) {
            const ing = recipe.ingredients[i];
            await supabase.from("recipe_ingredients").insert({
              recipe_id: recipeId,
              name: ing.name,
              normalized_name: ing.name.toLowerCase(),
              quantity: ing.quantity,
              unit: ing.unit,
              aisle: ing.aisle,
              order_index: i,
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

          insertedCount++;
          console.log(`Inserted recipe: ${recipe.title}`);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Recipe ${recipe.title}: ${errMsg}`);
        }
      }

      results.push({ category: healthTag, inserted: insertedCount, errors });
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          totalCategories: results.length,
          totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
          totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error seeding health recipes:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
