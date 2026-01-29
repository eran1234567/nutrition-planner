-- Add source_url column to recipes table for storing YouTube/Instagram/website links
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_url TEXT NULL;

-- Add a comment to describe the column's purpose
COMMENT ON COLUMN public.recipes.source_url IS 'Original URL from which this recipe was imported (YouTube, Instagram, website, etc.)';