-- Add brand column to ingredient_nutrition
ALTER TABLE ingredient_nutrition ADD COLUMN IF NOT EXISTS brand TEXT;

-- Create index for faster brand searches
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_brand ON ingredient_nutrition(brand);

-- Update existing products to extract brand from keywords or name patterns
-- Metamucil products
UPDATE ingredient_nutrition 
SET brand = 'Metamucil'
WHERE name ILIKE '%metamucil%' OR name ILIKE '%premium blend sugar free%';

-- Jif products  
UPDATE ingredient_nutrition
SET brand = 'Jif'
WHERE name ILIKE '%jif%' OR 'Jif' = ANY(keywords);

-- Silk products
UPDATE ingredient_nutrition
SET brand = 'Silk'
WHERE name ILIKE '%silk%' OR 'Silk' = ANY(keywords);

-- Fage products
UPDATE ingredient_nutrition
SET brand = 'Fage'
WHERE name ILIKE '%fage%' OR 'Fage' = ANY(keywords);

-- Chosen Foods products
UPDATE ingredient_nutrition
SET brand = 'Chosen Foods'
WHERE name ILIKE '%chosen foods%' OR 'Chosen Foods' = ANY(keywords);

-- Kerrygold products
UPDATE ingredient_nutrition
SET brand = 'Kerrygold'
WHERE name ILIKE '%kerrygold%' OR 'Kerrygold' = ANY(keywords) OR name ILIKE '%grass-fed butter%';

-- Navitas products
UPDATE ingredient_nutrition
SET brand = 'Navitas'
WHERE name ILIKE '%navitas%' OR 'Navitas' = ANY(keywords);