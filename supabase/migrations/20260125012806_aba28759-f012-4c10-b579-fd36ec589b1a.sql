-- Create a security definer function to check if a recipe is visible to the current user
-- This avoids RLS recursion and is performant because it uses indexed columns
CREATE OR REPLACE FUNCTION public.can_view_recipe(recipe_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id_param
      AND r.is_deleted = false
      AND (
        r.scope = 'global'::scope_type
        OR r.owner_user_id = auth.uid()
      )
  )
$$;

-- Add index on recipes to optimize the visibility check function
CREATE INDEX IF NOT EXISTS idx_recipes_id_scope_owner ON public.recipes (id, scope, owner_user_id) WHERE is_deleted = false;

-- ==================== recipe_ingredients ====================
DROP POLICY IF EXISTS "Allow read ingredients" ON public.recipe_ingredients;

CREATE POLICY "View accessible recipe ingredients"
ON public.recipe_ingredients
FOR SELECT
USING (public.can_view_recipe(recipe_id));

-- ==================== recipe_steps ====================
DROP POLICY IF EXISTS "Allow read steps" ON public.recipe_steps;

CREATE POLICY "View accessible recipe steps"
ON public.recipe_steps
FOR SELECT
USING (public.can_view_recipe(recipe_id));

-- ==================== recipe_nutrition ====================
DROP POLICY IF EXISTS "Allow read nutrition" ON public.recipe_nutrition;

CREATE POLICY "View accessible recipe nutrition"
ON public.recipe_nutrition
FOR SELECT
USING (public.can_view_recipe(recipe_id));

-- ==================== recipe_tags ====================
DROP POLICY IF EXISTS "Allow read tags" ON public.recipe_tags;

CREATE POLICY "View accessible recipe tags"
ON public.recipe_tags
FOR SELECT
USING (public.can_view_recipe(recipe_id));