-- Update avocado reference to use per-medium-avocado (136g) serving instead of per-100g
-- This ensures "2 medium avocado" correctly calculates as 2 × 20g fat = 40g fat

UPDATE ingredient_nutrition 
SET 
  name = 'Avocado (medium)',
  serving_description = '1 medium avocado (136g)',
  calories = 218,
  protein_g = 2.7,
  carbs_g = 11.6,
  fat_g = 20,
  fiber_g = 9.1,
  sugar_g = 0.95,
  sodium_mg = 10,
  saturated_fat_g = 2.9,
  cholesterol_mg = 0,
  keywords = ARRAY['avocado', 'avocados', 'medium avocado']
WHERE id = 'c1840a34-ef77-483d-9f4f-2b9e955b07b6';