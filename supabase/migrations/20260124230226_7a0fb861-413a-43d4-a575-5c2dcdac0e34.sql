-- Fix statement timeouts by making SELECT RLS policies role-specific (anon vs authenticated)
-- This prevents Postgres from OR-ing global + auth.uid() policies for anon queries.

BEGIN;

-- ========== recipes ==========
DROP POLICY IF EXISTS "Public can view global recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON public.recipes;

CREATE POLICY "Anon can view global recipes"
ON public.recipes
FOR SELECT
TO anon
USING ((scope = 'global'::public.scope_type) AND (is_deleted = false));

CREATE POLICY "Auth can view global recipes"
ON public.recipes
FOR SELECT
TO authenticated
USING ((scope = 'global'::public.scope_type) AND (is_deleted = false));

CREATE POLICY "Auth can view own recipes"
ON public.recipes
FOR SELECT
TO authenticated
USING ((owner_user_id = auth.uid()) AND (is_deleted = false));

-- ========== recipe_nutrition ==========
DROP POLICY IF EXISTS "View recipe nutrition" ON public.recipe_nutrition;

CREATE POLICY "Anon view global nutrition"
ON public.recipe_nutrition
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_nutrition.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view global nutrition"
ON public.recipe_nutrition
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_nutrition.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view own nutrition"
ON public.recipe_nutrition
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_nutrition.recipe_id
      AND r.owner_user_id = auth.uid()
      AND r.is_deleted = false
  )
);

-- ========== recipe_tags ==========
DROP POLICY IF EXISTS "View recipe tags" ON public.recipe_tags;

CREATE POLICY "Anon view global tags"
ON public.recipe_tags
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_tags.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view global tags"
ON public.recipe_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_tags.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view own tags"
ON public.recipe_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_tags.recipe_id
      AND r.owner_user_id = auth.uid()
      AND r.is_deleted = false
  )
);

-- ========== recipe_ingredients ==========
DROP POLICY IF EXISTS "View recipe ingredients" ON public.recipe_ingredients;

CREATE POLICY "Anon view global ingredients"
ON public.recipe_ingredients
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view global ingredients"
ON public.recipe_ingredients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view own ingredients"
ON public.recipe_ingredients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
      AND r.owner_user_id = auth.uid()
      AND r.is_deleted = false
  )
);

-- ========== recipe_steps ==========
DROP POLICY IF EXISTS "View recipe steps" ON public.recipe_steps;

CREATE POLICY "Anon view global steps"
ON public.recipe_steps
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_steps.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view global steps"
ON public.recipe_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_steps.recipe_id
      AND r.scope = 'global'::public.scope_type
      AND r.is_deleted = false
  )
);

CREATE POLICY "Auth view own steps"
ON public.recipe_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = recipe_steps.recipe_id
      AND r.owner_user_id = auth.uid()
      AND r.is_deleted = false
  )
);

COMMIT;