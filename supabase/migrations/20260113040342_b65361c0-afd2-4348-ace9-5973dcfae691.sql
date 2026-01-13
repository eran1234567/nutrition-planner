-- Add index on recipes table for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_recipes_owner_user_id ON public.recipes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_owner_deleted ON public.recipes(owner_user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);