-- Fix statement timeouts by avoiding OR conditions in RLS policies
-- Split the existing SELECT policy into two policies so the planner can use indexes efficiently.

DROP POLICY IF EXISTS "Anyone can view global recipes" ON public.recipes;

-- Public (anon + authenticated) can read global, non-deleted recipes
CREATE POLICY "Public can view global recipes"
ON public.recipes
FOR SELECT
TO public
USING (
  scope = 'global'::scope_type
  AND is_deleted = false
);

-- Authenticated users can read their own, non-deleted recipes
CREATE POLICY "Users can view own recipes"
ON public.recipes
FOR SELECT
TO public
USING (
  owner_user_id = auth.uid()
  AND is_deleted = false
);
