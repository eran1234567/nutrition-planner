-- Add missing DELETE policy for meal_plans table
-- This allows users to delete their own meal plans following the same ownership pattern
CREATE POLICY "Users can delete own meal plans"
ON public.meal_plans
FOR DELETE
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);