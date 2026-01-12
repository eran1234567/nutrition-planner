// Seed recipes for the app - comprehensive library with photos and macros
export interface SeedRecipe {
  id: string;
  scope: 'global' | 'private' | 'household';
  title: string;
  description?: string;
  servings: number;
  prep_time?: number;
  cook_time?: number;
  total_time?: number;
  cuisine?: string;
  difficulty: string;
  image_url?: string;
  is_kid_friendly: boolean;
  is_meal_prep_friendly: boolean;
  is_budget_friendly: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  nutrition: {
    id: string;
    recipe_id: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
    sugar_g?: number;
  };
  ingredients: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    normalized_name?: string;
    aisle?: string;
    order_index: number;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
  }>;
  tags: Array<{
    tag_type: string;
    tag_value: string;
  }>;
}

export const seedRecipes: SeedRecipe[] = [
  // BREAKFAST
  {
    id: 'seed-1',
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-1',
      recipe_id: 'seed-1',
      calories: 320,
      protein_g: 18,
      carbs_g: 42,
      fat_g: 10,
      fiber_g: 4,
      sodium_mg: 85,
      sugar_g: 24,
    },
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
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-2',
      recipe_id: 'seed-2',
      calories: 380,
      protein_g: 16,
      carbs_g: 28,
      fat_g: 24,
      fiber_g: 8,
      sodium_mg: 420,
    },
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
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-3',
      recipe_id: 'seed-3',
      calories: 380,
      protein_g: 12,
      carbs_g: 58,
      fat_g: 12,
      fiber_g: 8,
      sodium_mg: 150,
    },
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
  // LUNCH
  {
    id: 'seed-4',
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-4',
      recipe_id: 'seed-4',
      calories: 380,
      protein_g: 14,
      carbs_g: 42,
      fat_g: 18,
      fiber_g: 7,
      sodium_mg: 520,
    },
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
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-5',
      recipe_id: 'seed-5',
      calories: 450,
      protein_g: 38,
      carbs_g: 32,
      fat_g: 18,
      fiber_g: 4,
      sodium_mg: 680,
    },
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
  // DINNER
  {
    id: 'seed-6',
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-6',
      recipe_id: 'seed-6',
      calories: 420,
      protein_g: 42,
      carbs_g: 12,
      fat_g: 22,
      fiber_g: 4,
      sodium_mg: 380,
    },
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
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-7',
      recipe_id: 'seed-7',
      calories: 280,
      protein_g: 28,
      carbs_g: 12,
      fat_g: 14,
      fiber_g: 3,
      sodium_mg: 420,
    },
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
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-8',
      recipe_id: 'seed-8',
      calories: 380,
      protein_g: 32,
      carbs_g: 24,
      fat_g: 18,
      fiber_g: 5,
      sodium_mg: 480,
    },
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
  // SNACKS
  {
    id: 'seed-9',
    scope: 'global',
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
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-9',
      recipe_id: 'seed-9',
      calories: 180,
      protein_g: 6,
      carbs_g: 20,
      fat_g: 10,
      fiber_g: 6,
      sodium_mg: 280,
    },
    ingredients: [
      { name: 'Hummus', quantity: 0.5, unit: 'cup', normalized_name: 'hummus', aisle: 'Deli', order_index: 0 },
      { name: 'Carrots', quantity: 2, unit: 'medium', normalized_name: 'carrots', aisle: 'Produce', order_index: 1 },
      { name: 'Cucumber', quantity: 1, unit: 'medium', normalized_name: 'cucumber', aisle: 'Produce', order_index: 2 },
      { name: 'Bell pepper', quantity: 1, unit: 'medium', normalized_name: 'bell pepper', aisle: 'Produce', order_index: 3 },
      { name: 'Cherry tomatoes', quantity: 0.5, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 4 },
    ],
    steps: [
      { step_number: 1, instruction: 'Cut carrots, cucumber, and bell pepper into sticks.' },
      { step_number: 2, instruction: 'Arrange vegetables on a plate around a bowl of hummus.' },
      { step_number: 3, instruction: 'Add cherry tomatoes for variety.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'quick', tag_value: 'under-15' },
    ],
  },
  {
    id: 'seed-10',
    scope: 'global',
    title: 'Apple Slices with Almond Butter',
    description: 'Crisp apple slices paired with creamy almond butter',
    servings: 1,
    prep_time: 5,
    cook_time: 0,
    total_time: 5,
    cuisine: 'American',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1568702846914-96b305d2uj8f?w=800',
    is_kid_friendly: true,
    is_meal_prep_friendly: false,
    is_budget_friendly: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-10',
      recipe_id: 'seed-10',
      calories: 220,
      protein_g: 5,
      carbs_g: 28,
      fat_g: 12,
      fiber_g: 5,
      sodium_mg: 0,
    },
    ingredients: [
      { name: 'Apple', quantity: 1, unit: 'medium', normalized_name: 'apple', aisle: 'Produce', order_index: 0 },
      { name: 'Almond butter', quantity: 2, unit: 'tbsp', normalized_name: 'almond butter', aisle: 'Spreads', order_index: 1 },
      { name: 'Cinnamon', quantity: 0.25, unit: 'tsp', normalized_name: 'cinnamon', aisle: 'Spices', order_index: 2 },
    ],
    steps: [
      { step_number: 1, instruction: 'Core and slice apple into wedges.' },
      { step_number: 2, instruction: 'Serve with almond butter for dipping.' },
      { step_number: 3, instruction: 'Sprinkle with cinnamon if desired.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'snack' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'quick', tag_value: 'under-10' },
    ],
  },
  // More dinner options
  {
    id: 'seed-11',
    scope: 'global',
    title: 'Vegetable Stir Fry with Tofu',
    description: 'Colorful vegetables and crispy tofu in a savory ginger-garlic sauce',
    servings: 3,
    prep_time: 15,
    cook_time: 15,
    total_time: 30,
    cuisine: 'Asian',
    difficulty: 'medium',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: true,
    is_budget_friendly: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-11',
      recipe_id: 'seed-11',
      calories: 320,
      protein_g: 18,
      carbs_g: 28,
      fat_g: 16,
      fiber_g: 6,
      sodium_mg: 580,
    },
    ingredients: [
      { name: 'Extra firm tofu', quantity: 14, unit: 'oz', normalized_name: 'tofu', aisle: 'Produce', order_index: 0 },
      { name: 'Broccoli florets', quantity: 2, unit: 'cups', normalized_name: 'broccoli', aisle: 'Produce', order_index: 1 },
      { name: 'Bell peppers', quantity: 2, unit: 'medium', normalized_name: 'bell peppers', aisle: 'Produce', order_index: 2 },
      { name: 'Snap peas', quantity: 1, unit: 'cup', normalized_name: 'snap peas', aisle: 'Produce', order_index: 3 },
      { name: 'Soy sauce', quantity: 3, unit: 'tbsp', normalized_name: 'soy sauce', aisle: 'Asian', order_index: 4 },
      { name: 'Sesame oil', quantity: 1, unit: 'tbsp', normalized_name: 'sesame oil', aisle: 'Asian', order_index: 5 },
      { name: 'Ginger', quantity: 1, unit: 'tbsp', normalized_name: 'ginger', aisle: 'Produce', order_index: 6 },
      { name: 'Garlic', quantity: 3, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 7 },
    ],
    steps: [
      { step_number: 1, instruction: 'Press tofu and cut into cubes. Pan-fry until golden.' },
      { step_number: 2, instruction: 'Slice bell peppers. Mince garlic and ginger.' },
      { step_number: 3, instruction: 'Heat sesame oil in a wok. Add garlic and ginger, cook 30 seconds.' },
      { step_number: 4, instruction: 'Add broccoli and peppers, stir-fry 4-5 minutes.' },
      { step_number: 5, instruction: 'Add snap peas and tofu. Pour in soy sauce and toss together.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'vegan' },
      { tag_type: 'mealprep', tag_value: 'true' },
    ],
  },
  {
    id: 'seed-12',
    scope: 'global',
    title: 'Shrimp and Zucchini Noodles',
    description: 'Garlicky shrimp over light zucchini noodles with cherry tomatoes',
    servings: 2,
    prep_time: 15,
    cook_time: 10,
    total_time: 25,
    cuisine: 'Italian',
    difficulty: 'easy',
    image_url: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800',
    is_kid_friendly: false,
    is_meal_prep_friendly: false,
    is_budget_friendly: false,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nutrition: {
      id: 'nut-12',
      recipe_id: 'seed-12',
      calories: 280,
      protein_g: 28,
      carbs_g: 14,
      fat_g: 14,
      fiber_g: 4,
      sodium_mg: 420,
    },
    ingredients: [
      { name: 'Large shrimp', quantity: 12, unit: 'oz', normalized_name: 'shrimp', aisle: 'Seafood', order_index: 0 },
      { name: 'Zucchini', quantity: 3, unit: 'medium', normalized_name: 'zucchini', aisle: 'Produce', order_index: 1 },
      { name: 'Cherry tomatoes', quantity: 1, unit: 'cup', normalized_name: 'cherry tomatoes', aisle: 'Produce', order_index: 2 },
      { name: 'Garlic', quantity: 4, unit: 'cloves', normalized_name: 'garlic', aisle: 'Produce', order_index: 3 },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp', normalized_name: 'olive oil', aisle: 'Oils', order_index: 4 },
      { name: 'Red pepper flakes', quantity: 0.25, unit: 'tsp', normalized_name: 'red pepper flakes', aisle: 'Spices', order_index: 5 },
      { name: 'Fresh basil', quantity: 0.25, unit: 'cup', normalized_name: 'basil', aisle: 'Produce', order_index: 6 },
    ],
    steps: [
      { step_number: 1, instruction: 'Spiralize zucchini into noodles.' },
      { step_number: 2, instruction: 'Heat olive oil in a large pan. Add garlic and cook until fragrant.' },
      { step_number: 3, instruction: 'Add shrimp and red pepper flakes, cook until pink (3-4 minutes).' },
      { step_number: 4, instruction: 'Add halved cherry tomatoes and cook 2 minutes.' },
      { step_number: 5, instruction: 'Toss in zucchini noodles, cook 1-2 minutes. Top with fresh basil.' },
    ],
    tags: [
      { tag_type: 'meal', tag_value: 'dinner' },
      { tag_type: 'diet', tag_value: 'keto' },
      { tag_type: 'diet', tag_value: 'pescatarian' },
      { tag_type: 'medical', tag_value: 'diabetes-friendly' },
    ],
  },
];

export const getRecipesByMealType = (mealType: string) => {
  return seedRecipes.filter(recipe => 
    recipe.tags.some(tag => tag.tag_type === 'meal' && tag.tag_value === mealType)
  );
};

export const getQuickRecipes = (maxMinutes: number = 30) => {
  return seedRecipes.filter(recipe => 
    recipe.total_time && recipe.total_time <= maxMinutes
  );
};

export const getRecipesByDiet = (dietType: string) => {
  return seedRecipes.filter(recipe => 
    recipe.tags.some(tag => tag.tag_type === 'diet' && tag.tag_value === dietType)
  );
};
