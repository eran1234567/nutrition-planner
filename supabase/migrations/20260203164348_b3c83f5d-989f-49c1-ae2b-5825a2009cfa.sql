-- Add generic ingredient entries for common foods that may not have specific types
-- This ensures deterministic macro lookups work for basic ingredients

-- Generic bread (white bread, 1 slice)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('bread_slice', ARRAY['bread', 'toast', 'white bread', 'bread slice', 'slices bread', 'slice of bread'], '1 slice', 79, 2.7, 15, 1, 0.6, 1.5, 150, 0.2, 0)
ON CONFLICT (name) DO NOTHING;

-- Whole wheat bread (1 slice)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('whole_wheat_bread_slice', ARRAY['whole wheat bread', 'whole grain bread', 'wheat bread', 'brown bread'], '1 slice', 81, 4, 14, 1.1, 1.9, 1.4, 146, 0.2, 0)
ON CONFLICT (name) DO NOTHING;

-- Regular butter (1 tbsp)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('butter_tbsp', ARRAY['butter', 'salted butter', 'unsalted butter'], '1 tbsp', 102, 0.1, 0, 11.5, 0, 0, 91, 7.3, 31)
ON CONFLICT (name) DO NOTHING;

-- Olive oil (1 tbsp)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('olive_oil_tbsp', ARRAY['olive oil', 'extra virgin olive oil', 'evoo'], '1 tbsp', 119, 0, 0, 13.5, 0, 0, 0, 1.9, 0)
ON CONFLICT (name) DO NOTHING;

-- Tomato (1 medium)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('tomato_medium', ARRAY['tomato', 'tomatoes', 'roma tomato', 'cherry tomatoes'], '1 medium', 22, 1.1, 4.8, 0.2, 1.5, 3.2, 5, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- Onion (1 medium)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('onion_medium', ARRAY['onion', 'onions', 'yellow onion', 'white onion', 'red onion'], '1 medium', 44, 1.2, 10, 0.1, 1.4, 4.7, 4, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- Garlic (1 clove)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('garlic_clove', ARRAY['garlic', 'garlic clove', 'garlic cloves', 'minced garlic'], '1 clove', 4, 0.2, 1, 0, 0.1, 0, 1, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- Bacon (1 slice, cooked)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('bacon_slice', ARRAY['bacon', 'bacon strips', 'crispy bacon', 'bacon slices'], '1 slice', 43, 3, 0.1, 3.3, 0, 0, 137, 1.1, 9)
ON CONFLICT (name) DO NOTHING;

-- Milk (1 cup, whole)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('milk_cup', ARRAY['milk', 'whole milk', 'dairy milk'], '1 cup', 149, 8, 12, 8, 0, 12, 105, 4.6, 24)
ON CONFLICT (name) DO NOTHING;

-- Cheese (cheddar, 1 oz)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('cheddar_cheese_oz', ARRAY['cheddar', 'cheddar cheese', 'cheese', 'shredded cheese'], '1 oz', 115, 7, 0.5, 9, 0, 0.1, 180, 5.7, 28)
ON CONFLICT (name) DO NOTHING;

-- Salt (for "to taste" normalization - 1/4 tsp)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('salt_quarter_tsp', ARRAY['salt', 'sea salt', 'kosher salt', 'table salt'], '1/4 tsp', 0, 0, 0, 0, 0, 0, 580, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- Pepper (1/4 tsp)
INSERT INTO ingredient_nutrition (name, keywords, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, cholesterol_mg)
VALUES ('pepper_quarter_tsp', ARRAY['pepper', 'black pepper', 'ground pepper'], '1/4 tsp', 1, 0, 0.3, 0, 0.1, 0, 0, 0, 0)
ON CONFLICT (name) DO NOTHING;