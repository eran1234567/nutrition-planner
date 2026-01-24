-- Performance indexes to prevent statement timeouts when loading global recipes

CREATE INDEX IF NOT EXISTS idx_recipe_nutrition_recipe_id
  ON public.recipe_nutrition (recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id
  ON public.recipe_tags (recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON public.recipe_ingredients (recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
  ON public.recipe_steps (recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipes_scope_is_deleted_title
  ON public.recipes (scope, is_deleted, title);
