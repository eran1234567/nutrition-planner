-- Make recipes.is_deleted non-null to avoid OR filters that defeat indexes
UPDATE public.recipes
SET is_deleted = false
WHERE is_deleted IS NULL;

ALTER TABLE public.recipes
  ALTER COLUMN is_deleted SET DEFAULT false;

ALTER TABLE public.recipes
  ALTER COLUMN is_deleted SET NOT NULL;