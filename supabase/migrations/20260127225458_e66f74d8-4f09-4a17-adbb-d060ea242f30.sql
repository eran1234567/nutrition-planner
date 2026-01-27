-- Enable realtime for upload_recipe_links table to allow live count updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.upload_recipe_links;