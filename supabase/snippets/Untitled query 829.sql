-- Adding the fiber columns to the local database
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS fiber_g DECIMAL(10,2);
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'ai';
ALTER TABLE recipe_nutrition ADD COLUMN IF NOT EXISTS fiber_g DECIMAL(10,2);