import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useYouTubeImport } from '@/hooks/useYouTubeImport';

// YouTube channel/playlist detection patterns
const YOUTUBE_CHANNEL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/i,
];
const YOUTUBE_PLAYLIST_PATTERN = /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=/i;

export function isYouTubeChannelOrPlaylist(url: string): boolean {
  return YOUTUBE_CHANNEL_PATTERNS.some(p => p.test(url)) || YOUTUBE_PLAYLIST_PATTERN.test(url);
}

interface ImportProgress {
  name: string;
  progress: number;
}

interface UseRecipeImportReturn {
  // Single recipe import (URL or file)
  importFromUrl: (url: string) => Promise<{ success: boolean; count?: number }>;
  importFromFile: (file: File) => Promise<{ success: boolean; count?: number }>;
  isImporting: boolean;
  importProgress: ImportProgress | null;
  
  // YouTube channel/playlist import (background processing)
  youtubeImport: ReturnType<typeof useYouTubeImport>;
  
  // Helpers
  formatApiError: (raw?: string | null) => string | null;
  isYouTubeChannelOrPlaylist: (url: string) => boolean;
}

export function useRecipeImport(): UseRecipeImportReturn {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  
  // YouTube channel/playlist import hook
  const youtubeImport = useYouTubeImport();

  // Format API errors into user-friendly messages
  const formatApiError = useCallback((raw?: string | null): string | null => {
    const msg = (raw || '').trim();
    if (!msg) return null;
    if (/\b429\b/.test(msg) || /resource exhausted/i.test(msg) || /quota/i.test(msg) || /rate limit/i.test(msg)) {
      return t('myRecipes.quotaExceeded', 'AI quota/rate limit reached. Please try again later or increase your AI key quota/billing.');
    }
    return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
  }, [t]);

  // Import from URL (single video or regular recipe URL)
  const importFromUrl = useCallback(async (url: string): Promise<{ success: boolean; count?: number }> => {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      toast.error(t('myRecipes.invalidUrl', 'Please enter a valid URL'));
      return { success: false };
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return { success: false };
    }

    // For YouTube channels/playlists, use background processing
    if (isYouTubeChannelOrPlaylist(url)) {
      await youtubeImport.startChannelImport(url);
      return { success: true }; // Background job started
    }

    // Single video or regular URL - process inline
    setIsImporting(true);
    setImportProgress({ name: parsedUrl.hostname, progress: 10 });

    try {
      // Create upload record
      const { data: uploadData, error } = await supabase.from('uploads').insert({
        owner_user_id: user.id,
        source_url: url,
        file_name: parsedUrl.hostname,
        status: 'pending',
        scope: 'private'
      }).select().single();

      if (error) throw error;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
      }, 800);

      // Call parse-recipe
      const { data, error: invokeError } = await supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId: uploadData.id, 
          sourceUrl: url
        },
      });

      clearInterval(progressInterval);
      setImportProgress(prev => prev ? { ...prev, progress: 100 } : null);

      // Handle invoke-level errors (including 429 rate limits)
      if (invokeError) {
        const errorMsg = invokeError.message || String(invokeError);
        toast.error(formatApiError(errorMsg) || t('myRecipes.parseError', 'Failed to parse recipe'));
        return { success: false };
      }

      if (data?.success) {
        toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
        // Short delay before clearing progress
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, count: data.count };
      } else {
        toast.error(formatApiError(data?.error) || t('myRecipes.parseError', 'Failed to parse recipe'));
        return { success: false };
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('URL import error:', error);
      toast.error(t('myRecipes.linkError', 'Failed to save link'));
      return { success: false };
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [t, formatApiError, youtubeImport]);

  // Import from file (image, document, text)
  const importFromFile = useCallback(async (file: File): Promise<{ success: boolean; count?: number }> => {
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('common.loginRequired', 'Please log in'));
      return { success: false };
    }

    // Determine file type
    const isImage = file.type.startsWith('image/');
    const isDocument = file.type === 'application/pdf' || 
                       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.type === 'application/msword' ||
                       file.name.endsWith('.docx') || 
                       file.name.endsWith('.doc') || 
                       file.name.endsWith('.pdf');
    const isText = file.type.startsWith('text/') || file.type === 'application/json';

    // Read file content based on type
    let fileContent = '';
    
    if (isImage || isDocument) {
      // Convert to base64
      fileContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } else if (isText) {
      fileContent = await file.text();
    }

    if (!fileContent) {
      toast.error(t('myRecipes.unsupportedFile', 'Unsupported file type'));
      return { success: false };
    }

    // Determine proper MIME type
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = file.name.toLowerCase().split('.').pop();
      const mimeMap: Record<string, string> = {
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      mimeType = mimeMap[ext || ''] || 'application/octet-stream';
    }

    setIsImporting(true);
    setImportProgress({ name: file.name, progress: 10 });

    try {
      // Create upload record
      const { data: uploadData, error } = await supabase.from('uploads').insert({
        owner_user_id: user.id,
        file_name: file.name,
        file_type: mimeType,
        status: 'pending',
        scope: 'private'
      }).select().single();

      if (error) throw error;

      toast.success(t('myRecipes.uploadSuccess', 'File added successfully'));

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => prev ? { ...prev, progress: Math.min(prev.progress + 15, 85) } : null);
      }, 800);

      // Call parse-recipe
      const { data, error: invokeError } = await supabase.functions.invoke('parse-recipe', {
        body: { 
          uploadId: uploadData.id, 
          content: fileContent,
          isImage: isImage || false
        },
      });

      clearInterval(progressInterval);
      setImportProgress(prev => prev ? { ...prev, progress: 100 } : null);

      // Handle invoke-level errors (including 429 rate limits)
      if (invokeError) {
        const errorMsg = invokeError.message || String(invokeError);
        toast.error(formatApiError(errorMsg) || t('myRecipes.parseError', 'Failed to parse recipe'));
        await supabase.from('uploads').update({ 
          status: 'failed', 
          error_message: errorMsg 
        }).eq('id', uploadData.id);
        return { success: false };
      }

      if (data?.success) {
        toast.success(t('myRecipes.parseSuccess', `Found ${data.count} recipe(s)!`));
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, count: data.count };
      } else {
        toast.error(formatApiError(data?.error) || t('myRecipes.parseError', 'Failed to parse recipe'));
        // Update upload status to failed
        await supabase.from('uploads').update({ 
          status: 'failed', 
          error_message: data?.error || 'Parse failed' 
        }).eq('id', uploadData.id);
        return { success: false };
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('File import error:', error);
      toast.error(t('myRecipes.uploadError', 'Failed to save file'));
      return { success: false };
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [t, formatApiError]);

  return {
    importFromUrl,
    importFromFile,
    isImporting,
    importProgress,
    youtubeImport,
    formatApiError,
    isYouTubeChannelOrPlaylist,
  };
}
