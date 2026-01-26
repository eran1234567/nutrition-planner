import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImportJob {
  id: string;
  channel_url: string;
  channel_name: string | null;
  total_videos: number;
  processed_videos: number;
  recipes_created: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

interface UseYouTubeImportReturn {
  activeJob: ImportJob | null;
  isStarting: boolean;
  startChannelImport: (channelUrl: string) => Promise<void>;
  progress: number;
  cancelImport: () => void;
}

export function useYouTubeImport(): UseYouTubeImportReturn {
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [processingInterval, setProcessingInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Calculate progress percentage
  const progress = activeJob 
    ? Math.round((activeJob.processed_videos / activeJob.total_videos) * 100) 
    : 0;

  // Subscribe to realtime updates for active job
  useEffect(() => {
    if (!activeJob?.id) return;

    const channel = supabase
      .channel(`youtube_import_${activeJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'youtube_import_jobs',
          filter: `id=eq.${activeJob.id}`,
        },
        (payload) => {
          const updated = payload.new as ImportJob;
          setActiveJob(updated);
          
          if (updated.status === 'completed') {
            toast({
              title: 'Import Complete!',
              description: `Created ${updated.recipes_created} recipes from ${updated.processed_videos} videos.`,
            });
          } else if (updated.status === 'failed') {
            toast({
              title: 'Import Failed',
              description: updated.error_message || 'An error occurred during import.',
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id, toast]);

  // Process batches while job is active
  useEffect(() => {
    if (!activeJob?.id || activeJob.status !== 'processing') {
      if (processingInterval) {
        clearInterval(processingInterval);
        setProcessingInterval(null);
      }
      return;
    }

    // Process a batch every 2 seconds
    const processBatch = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-youtube-channel`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'process-batch',
              jobId: activeJob.id,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error('Batch processing error:', error);
        }
      } catch (err) {
        console.error('Error processing batch:', err);
      }
    };

    // Start processing immediately, then continue every 3 seconds
    processBatch();
    const interval = setInterval(processBatch, 3000);
    setProcessingInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [activeJob?.id, activeJob?.status]);

  // Check for existing active job on mount
  useEffect(() => {
    const checkExistingJob = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      const { data: jobs } = await supabase
        .from('youtube_import_jobs')
        .select('*')
        .eq('owner_user_id', session.session.user.id)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        setActiveJob(jobs[0] as ImportJob);
      }
    };

    checkExistingJob();
  }, []);

  const startChannelImport = useCallback(async (channelUrl: string) => {
    setIsStarting(true);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Please sign in to import channels');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-youtube-channel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'start',
            channelUrl,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start import');
      }

      toast({
        title: 'Import Started',
        description: result.message,
      });

      // Fetch the created job
      const { data: job } = await supabase
        .from('youtube_import_jobs')
        .select('*')
        .eq('id', result.jobId)
        .single();

      if (job) {
        setActiveJob(job as ImportJob);
      }
    } catch (err) {
      toast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  }, [toast]);

  const cancelImport = useCallback(() => {
    if (processingInterval) {
      clearInterval(processingInterval);
      setProcessingInterval(null);
    }
    setActiveJob(null);
  }, [processingInterval]);

  return {
    activeJob,
    isStarting,
    startChannelImport,
    progress,
    cancelImport,
  };
}
