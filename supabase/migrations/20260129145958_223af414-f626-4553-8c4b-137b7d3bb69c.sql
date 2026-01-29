-- Add section column to recipe_ingredients table for multi-part recipes
ALTER TABLE public.recipe_ingredients 
ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'Main';

-- Add comment for documentation
COMMENT ON COLUMN public.recipe_ingredients.section IS 'Ingredient section/category (e.g., Main, Marinade, Sauce, Dressing)';