-- Add introduces_section column to recipe_steps table
-- This field indicates that this step is the first one where a specific ingredient section is used
-- e.g., if step 6 is the first step that uses "Creamy Tehina" ingredients, that step has introduces_section = 'Creamy Tehina'
ALTER TABLE public.recipe_steps 
ADD COLUMN introduces_section TEXT DEFAULT NULL;

-- Add a comment explaining the field's purpose
COMMENT ON COLUMN public.recipe_steps.introduces_section IS 'The ingredient section name that is first introduced at this step (e.g., "Marinade", "Creamy Tehina"). NULL means no new section is introduced.';