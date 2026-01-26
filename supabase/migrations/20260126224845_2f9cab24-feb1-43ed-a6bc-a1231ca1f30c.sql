-- Create table to track YouTube channel import jobs
CREATE TABLE public.youtube_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  channel_url TEXT NOT NULL,
  channel_name TEXT,
  total_videos INTEGER NOT NULL DEFAULT 0,
  processed_videos INTEGER NOT NULL DEFAULT 0,
  recipes_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  video_urls TEXT[] DEFAULT '{}',
  current_batch INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.youtube_import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own import jobs
CREATE POLICY "Users can view their own import jobs" 
ON public.youtube_import_jobs 
FOR SELECT 
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own import jobs" 
ON public.youtube_import_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own import jobs" 
ON public.youtube_import_jobs 
FOR UPDATE 
USING (auth.uid() = owner_user_id);

-- Enable realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_import_jobs;

-- Add trigger for updated_at
CREATE TRIGGER update_youtube_import_jobs_updated_at
BEFORE UPDATE ON public.youtube_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();