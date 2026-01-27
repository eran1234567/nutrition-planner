-- Add upload_id column to youtube_import_jobs to link to the uploads table
ALTER TABLE public.youtube_import_jobs 
ADD COLUMN upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_youtube_import_jobs_upload_id ON public.youtube_import_jobs(upload_id);