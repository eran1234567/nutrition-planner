-- Add serving_size column to recipes table
ALTER TABLE public.recipes 
ADD COLUMN IF NOT EXISTS serving_size text;

-- Add comment for documentation
COMMENT ON COLUMN public.recipes.serving_size IS 'Human-readable description of what 1 serving contains (e.g., "4 meatballs + 1.5 cups potatoes + 1 cup sauce")';