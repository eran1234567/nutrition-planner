import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// YouTube channel/playlist URL patterns
const YOUTUBE_CHANNEL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/i,
];

const YOUTUBE_PLAYLIST_PATTERN = /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=([\w-]+)/i;

// Extract channel ID from various YouTube channel URL formats
async function getYouTubeChannelId(url: string, apiKey: string): Promise<{ channelId: string | null; channelName: string | null }> {
  try {
    // Direct channel ID format
    const channelIdMatch = url.match(/\/channel\/([\w-]+)/i);
    if (channelIdMatch) {
      // Get channel name
      const infoUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIdMatch[1]}&key=${apiKey}`;
      const infoResponse = await fetch(infoUrl);
      const infoData = await infoResponse.json();
      const channelName = infoData.items?.[0]?.snippet?.title || null;
      return { channelId: channelIdMatch[1], channelName };
    }

    // For @username, /c/, or /user/ formats
    const handleMatch = url.match(/@([\w-]+)/);
    const customMatch = url.match(/\/c\/([\w-]+)/i);
    const userMatch = url.match(/\/user\/([\w-]+)/i);
    
    const identifier = handleMatch?.[1] || customMatch?.[1] || userMatch?.[1];
    if (!identifier) return { channelId: null, channelName: null };

    // Use forHandle for @username format (YouTube API v3)
    if (handleMatch) {
      const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=${identifier}&key=${apiKey}`;
      const response = await fetch(handleUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.items?.[0]) {
          return { 
            channelId: data.items[0].id, 
            channelName: data.items[0].snippet?.title || identifier 
          };
        }
      }
    }

    // Fallback: search for the channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(identifier)}&key=${apiKey}&maxResults=1`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.warn('YouTube API search failed:', response.status);
      return { channelId: null, channelName: null };
    }
    
    const data = await response.json();
    const channelId = data.items?.[0]?.snippet?.channelId || null;
    const channelName = data.items?.[0]?.snippet?.title || null;
    return { channelId, channelName };
  } catch (err) {
    console.error('Error resolving YouTube channel ID:', err);
    return { channelId: null, channelName: null };
  }
}

// Get ALL videos from a YouTube channel (paginated)
async function getAllChannelVideos(channelId: string, apiKey: string, maxVideos = 300): Promise<string[]> {
  try {
    // First get the uploads playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const channelResponse = await fetch(channelUrl);
    if (!channelResponse.ok) {
      console.warn('YouTube API channel fetch failed:', channelResponse.status);
      return [];
    }
    
    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.warn('Could not find uploads playlist for channel');
      return [];
    }

    return await getAllPlaylistVideos(uploadsPlaylistId, apiKey, maxVideos);
  } catch (err) {
    console.error('Error fetching channel videos:', err);
    return [];
  }
}

// Get ALL videos from a YouTube playlist (paginated)
async function getAllPlaylistVideos(playlistId: string, apiKey: string, maxVideos = 300): Promise<string[]> {
  try {
    const videoUrls: string[] = [];
    let pageToken = '';
    
    while (videoUrls.length < maxVideos) {
      const remaining = maxVideos - videoUrls.length;
      const fetchCount = Math.min(remaining, 50);
      
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${fetchCount}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        console.warn('YouTube API playlist fetch failed:', response.status);
        break;
      }
      
      const data = await response.json();
      
      for (const item of data.items || []) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (videoId) {
          videoUrls.push(`https://www.youtube.com/watch?v=${videoId}`);
        }
      }
      
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    
    return videoUrls.slice(0, maxVideos);
  } catch (err) {
    console.error('Error fetching playlist videos:', err);
    return [];
  }
}

// Check if URL is a YouTube channel or playlist
function isYouTubeChannelOrPlaylist(url: string): 'channel' | 'playlist' | null {
  if (YOUTUBE_CHANNEL_PATTERNS.some(pattern => pattern.test(url))) {
    return 'channel';
  }
  if (YOUTUBE_PLAYLIST_PATTERN.test(url)) {
    return 'playlist';
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    
    if (!YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, channelUrl, jobId } = body;

    if (action === 'start') {
      // START: Create a new import job and fetch all video URLs
      if (!channelUrl) {
        throw new Error('Channel URL is required');
      }

      const youtubeType = isYouTubeChannelOrPlaylist(channelUrl);
      if (!youtubeType) {
        throw new Error('Invalid YouTube channel or playlist URL');
      }

      console.log(`Starting ${youtubeType} import for: ${channelUrl}`);

      let videoUrls: string[] = [];
      let channelName: string | null = null;

      if (youtubeType === 'channel') {
        const { channelId, channelName: name } = await getYouTubeChannelId(channelUrl, YOUTUBE_API_KEY);
        channelName = name;
        if (channelId) {
          videoUrls = await getAllChannelVideos(channelId, YOUTUBE_API_KEY, 300);
        }
      } else if (youtubeType === 'playlist') {
        const playlistMatch = channelUrl.match(YOUTUBE_PLAYLIST_PATTERN);
        if (playlistMatch?.[2]) {
          videoUrls = await getAllPlaylistVideos(playlistMatch[2], YOUTUBE_API_KEY, 300);
          channelName = `Playlist ${playlistMatch[2]}`;
        }
      }

      if (videoUrls.length === 0) {
        throw new Error('Could not find any videos. Make sure the channel/playlist is public.');
      }

      console.log(`Found ${videoUrls.length} videos`);

      // Create an upload record so user can manage/delete this source
      const displayName = channelName || (youtubeType === 'playlist' ? 'YouTube Playlist' : 'YouTube Channel');
      const { data: uploadData, error: uploadError } = await supabase
        .from('uploads')
        .insert({
          owner_user_id: userId,
          source_url: channelUrl,
          file_name: displayName,
          status: 'parsing',
          scope: 'private',
        })
        .select()
        .single();

      if (uploadError) {
        console.warn('Failed to create upload record:', uploadError.message);
        // Continue anyway - the job will still work, just won't be deletable as a source
      }

      const uploadId = uploadData?.id || null;

      // Create job record with upload_id reference
      const { data: job, error: jobError } = await supabase
        .from('youtube_import_jobs')
        .insert({
          owner_user_id: userId,
          channel_url: channelUrl,
          channel_name: channelName,
          total_videos: videoUrls.length,
          video_urls: videoUrls,
          status: 'processing',
          upload_id: uploadId,
        })
        .select()
        .single();

      if (jobError) {
        throw new Error(`Failed to create import job: ${jobError.message}`);
      }

      // Start processing first batch immediately (background will continue)
      // Edge function will timeout, but we'll process in batches
      console.log(`Created job ${job.id} with upload ${uploadId}, starting batch processing...`);

      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          uploadId,
          totalVideos: videoUrls.length,
          channelName,
          message: `Started importing ${videoUrls.length} videos from ${channelName || 'channel'}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'process-batch') {
      // PROCESS BATCH: Called repeatedly to process videos in batches
      if (!jobId) {
        throw new Error('Job ID is required');
      }

      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('youtube_import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error('Job not found');
      }

      if (job.owner_user_id !== userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return new Response(
          JSON.stringify({ success: true, status: job.status, message: 'Job already finished' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const BATCH_SIZE = 3; // Process 3 videos per batch call
      const videoUrls = job.video_urls as string[];
      const startIdx = job.processed_videos;
      const endIdx = Math.min(startIdx + BATCH_SIZE, videoUrls.length);
      const batchVideos = videoUrls.slice(startIdx, endIdx);

      if (batchVideos.length === 0) {
        // All done - update job and upload status
        await supabase
          .from('youtube_import_jobs')
          .update({ status: 'completed' })
          .eq('id', jobId);

        // Update upload status to 'parsed'
        if (job.upload_id) {
          await supabase
            .from('uploads')
            .update({ status: 'parsed' })
            .eq('id', job.upload_id);
        }

        return new Response(
          JSON.stringify({ success: true, status: 'completed', recipesCreated: job.recipes_created }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Processing batch ${job.current_batch + 1}: videos ${startIdx + 1}-${endIdx} of ${videoUrls.length}`);

      let recipesCreated = 0;
      let fatalError: string | null = null;

      // Process each video in this batch
      for (const videoUrl of batchVideos) {
        try {
          console.log(`Processing video: ${videoUrl}`);
          
          // Call parse-recipe for this single video, passing uploadId to link recipes to the source
          const parseResponse = await fetch(`${supabaseUrl}/functions/v1/parse-recipe`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sourceUrl: videoUrl,
              uploadId: job.upload_id, // Link recipes to the channel/playlist upload source
              batchMode: true, // Skip uploadId validation for batch YouTube imports
            }),
          });

          if (parseResponse.ok) {
            const result = await parseResponse.json();
            const created = Array.isArray(result?.recipes)
              ? result.recipes
              : Array.isArray(result?.savedRecipes)
                ? result.savedRecipes
                : [];

            if (result?.success && created.length > 0) {
              recipesCreated += created.length;
              console.log(`Created ${created.length} recipes from video`);
            }
          } else {
            let errMsg = `HTTP ${parseResponse.status}`;
            try {
              const errJson = await parseResponse.json();
              errMsg = errJson?.error || errJson?.message || JSON.stringify(errJson);
            } catch {
              // ignore JSON parse errors
            }

            console.warn(`Failed to process video ${videoUrl}: ${parseResponse.status} - ${errMsg}`);

            // If Gemini is rate-limited / quota-exhausted, fail the whole job quickly with a clear message.
            if (parseResponse.status === 429) {
              fatalError = `Gemini quota/rate limit hit. Please enable billing / increase quota for your Gemini API key, then re-run the import. (${errMsg})`;
              break;
            }
          }
        } catch (err) {
          console.error(`Error processing video ${videoUrl}:`, err);
        }

        if (fatalError) break;
      }

      if (fatalError) {
        await supabase
          .from('youtube_import_jobs')
          .update({
            status: 'failed',
            error_message: fatalError,
          })
          .eq('id', jobId);

        // Update upload status to 'failed'
        if (job.upload_id) {
          await supabase
            .from('uploads')
            .update({ status: 'failed', error_message: fatalError })
            .eq('id', job.upload_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: 'failed',
            error: fatalError,
            processedVideos: job.processed_videos,
            totalVideos: videoUrls.length,
            recipesCreated: job.recipes_created + recipesCreated,
            hasMore: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update job progress
      const newProcessedCount = endIdx;
      const newRecipesCount = job.recipes_created + recipesCreated;
      const isComplete = newProcessedCount >= videoUrls.length;

      await supabase
        .from('youtube_import_jobs')
        .update({
          processed_videos: newProcessedCount,
          recipes_created: newRecipesCount,
          current_batch: job.current_batch + 1,
          status: isComplete ? 'completed' : 'processing',
        })
        .eq('id', jobId);

      // Update upload status when complete
      if (isComplete && job.upload_id) {
        await supabase
          .from('uploads')
          .update({ status: 'parsed' })
          .eq('id', job.upload_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: isComplete ? 'completed' : 'processing',
          processedVideos: newProcessedCount,
          totalVideos: videoUrls.length,
          recipesCreated: newRecipesCount,
          hasMore: !isComplete,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action. Use "start" or "process-batch"');
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
