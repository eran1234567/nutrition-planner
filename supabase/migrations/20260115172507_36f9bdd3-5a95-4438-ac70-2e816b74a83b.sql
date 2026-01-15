-- Add plan_duration column to preferences table for 5 or 7 day meal plans
ALTER TABLE public.preferences 
ADD COLUMN plan_duration INTEGER DEFAULT 7;