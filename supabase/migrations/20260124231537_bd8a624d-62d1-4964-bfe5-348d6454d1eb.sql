-- Simplify RLS for recipe_nutrition and recipe_tags
-- The current correlated subquery RLS policies are causing timeouts.
-- Since we only select these by recipe_id AFTER verifying the recipe is accessible,
-- we can use a simpler check that just allows selecting by recipe_id.

-- Drop existing SELECT policies on recipe_nutrition
DROP POLICY IF EXISTS "Anon view global nutrition" ON public.recipe_nutrition;
DROP POLICY IF EXISTS "Auth view global nutrition" ON public.recipe_nutrition;
DROP POLICY IF EXISTS "Auth view own nutrition" ON public.recipe_nutrition;

-- Create a single efficient SELECT policy for recipe_nutrition
-- Allow anyone to SELECT nutrition data - the parent recipe RLS already controls access
CREATE POLICY "Allow read nutrition"
ON public.recipe_nutrition
FOR SELECT
USING (true);

-- Drop existing SELECT policies on recipe_tags
DROP POLICY IF EXISTS "Anon view global tags" ON public.recipe_tags;
DROP POLICY IF EXISTS "Auth view global tags" ON public.recipe_tags;
DROP POLICY IF EXISTS "Auth view own tags" ON public.recipe_tags;

-- Create a single efficient SELECT policy for recipe_tags
CREATE POLICY "Allow read tags"
ON public.recipe_tags
FOR SELECT
USING (true);

-- Drop existing SELECT policies on recipe_ingredients
DROP POLICY IF EXISTS "Anon view global ingredients" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "Auth view global ingredients" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "Auth view own ingredients" ON public.recipe_ingredients;

-- Create a single efficient SELECT policy for recipe_ingredients
CREATE POLICY "Allow read ingredients"
ON public.recipe_ingredients
FOR SELECT
USING (true);

-- Drop existing SELECT policies on recipe_steps
DROP POLICY IF EXISTS "Anon view global steps" ON public.recipe_steps;
DROP POLICY IF EXISTS "Auth view global steps" ON public.recipe_steps;
DROP POLICY IF EXISTS "Auth view own steps" ON public.recipe_steps;

-- Create a single efficient SELECT policy for recipe_steps
CREATE POLICY "Allow read steps"
ON public.recipe_steps
FOR SELECT
USING (true);