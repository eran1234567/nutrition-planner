import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import JSZip from 'https://esm.sh/jszip@3.10.1';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(input, init);

      // Retry on rate limiting
      if (resp.status === 429) {
        const retryAfter = resp.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : NaN;
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
        const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : backoffMs;
        console.warn(`[fetchWithRetry] 429 received; waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(waitMs);
        continue;
      }

      return resp;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxRetries) break;
      const waitMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
      console.warn(`[fetchWithRetry] fetch failed; waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`, e);
      await sleep(waitMs);
    }
  }

  throw lastErr instanceof Error
    ? new Error(`[fetchWithRetry] Max retries exceeded: ${lastErr.message}`)
    : new Error('[fetchWithRetry] Max retries exceeded');
}

function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)instagram\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function decodeHtmlEntitiesLite(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractOgDescriptionFromHtml(html: string): string | null {
  // Look for a <meta ... property="og:description" ... content="..."> tag.
  // Instagram frequently includes this and it is far smaller than full HTML.
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!/\bproperty\s*=\s*["']og:description["']/i.test(tag)) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    const content = contentMatch?.[1]?.trim();
    if (!content) return null;
    return decodeHtmlEntitiesLite(content);
  }
  return null;
}

// Magic bytes for file type validation
const MAGIC_BYTES = {
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  gif: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF header, followed by WEBP at bytes 8-11
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4B, 0x03, 0x04]], // PK.. (ZIP archive)
};

// Validate file magic bytes match claimed type
function validateMagicBytes(base64Content: string, expectedType: 'image' | 'pdf' | 'docx'): { valid: boolean; detectedType: string | null } {
  try {
    // Remove data URL prefix and get raw base64
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Decode first 16 bytes for checking
    const binaryString = atob(base64Data.substring(0, 24)); // 24 base64 chars = 18 bytes
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check for each known type
    const matchesMagic = (patterns: number[][]) => {
      return patterns.some(pattern => 
        pattern.every((byte, idx) => bytes[idx] === byte)
      );
    };

    // Detect actual file type
    if (matchesMagic(MAGIC_BYTES.jpeg)) return { valid: expectedType === 'image', detectedType: 'jpeg' };
    if (matchesMagic(MAGIC_BYTES.png)) return { valid: expectedType === 'image', detectedType: 'png' };
    if (matchesMagic(MAGIC_BYTES.gif)) return { valid: expectedType === 'image', detectedType: 'gif' };
    if (matchesMagic(MAGIC_BYTES.webp)) return { valid: expectedType === 'image', detectedType: 'webp' };
    if (matchesMagic(MAGIC_BYTES.pdf)) return { valid: expectedType === 'pdf', detectedType: 'pdf' };
    if (matchesMagic(MAGIC_BYTES.docx)) return { valid: expectedType === 'docx', detectedType: 'docx' };

    return { valid: false, detectedType: null };
  } catch (err) {
    console.error('Magic byte validation error:', err);
    return { valid: false, detectedType: null };
  }
}

// Extract text content from DOCX file (which is a ZIP containing XML)
async function extractTextFromDocx(base64Content: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load as ZIP
    const zip = await JSZip.loadAsync(bytes);
    
    // Get the main document content
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('No document.xml found in DOCX');
    }
    
    // Extract text from XML - simple regex-based extraction
    // Remove XML tags and extract text content
    let text = documentXml
      // Extract text from <w:t> tags (Word text elements)
      .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
      // Handle paragraph breaks
      .replace(/<\/w:p>/g, '\n')
      // Remove remaining XML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Clean up whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    console.log(`Extracted ${text.length} characters from DOCX`);
    return text;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX file');
  }
}

// YouTube channel/playlist URL patterns
const YOUTUBE_CHANNEL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/i,           // @username format
  /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/i,   // /channel/ID format
  /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/i,         // /c/name format (legacy)
  /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/i,      // /user/name format (legacy)
];

const YOUTUBE_PLAYLIST_PATTERN = /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=([\w-]+)/i;

// Extract channel ID from various YouTube channel URL formats
async function getYouTubeChannelId(url: string, apiKey: string): Promise<string | null> {
  try {
    // Direct channel ID format
    const channelIdMatch = url.match(/\/channel\/([\w-]+)/i);
    if (channelIdMatch) {
      return channelIdMatch[1];
    }

    // For @username, /c/, or /user/ formats, we need to resolve via API
    const handleMatch = url.match(/@([\w-]+)/);
    const customMatch = url.match(/\/c\/([\w-]+)/i);
    const userMatch = url.match(/\/user\/([\w-]+)/i);
    
    const identifier = handleMatch?.[1] || customMatch?.[1] || userMatch?.[1];
    if (!identifier) return null;

    // Use YouTube Data API to resolve handle to channel ID
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(identifier)}&key=${apiKey}&maxResults=1`;
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.warn('YouTube API search failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.items?.[0]?.snippet?.channelId || null;
  } catch (err) {
    console.error('Error resolving YouTube channel ID:', err);
    return null;
  }
}

// Get videos from a YouTube channel (up to maxResults)
async function getChannelVideos(channelId: string, apiKey: string, maxResults = 20): Promise<string[]> {
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

    return await getPlaylistVideos(uploadsPlaylistId, apiKey, maxResults);
  } catch (err) {
    console.error('Error fetching channel videos:', err);
    return [];
  }
}

// Get videos from a YouTube playlist
async function getPlaylistVideos(playlistId: string, apiKey: string, maxResults = 20): Promise<string[]> {
  try {
    const videoUrls: string[] = [];
    let pageToken = '';
    
    while (videoUrls.length < maxResults) {
      const remaining = maxResults - videoUrls.length;
      const fetchCount = Math.min(remaining, 50); // API max is 50 per request
      
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
    
    return videoUrls.slice(0, maxResults);
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

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  // Handle youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  
  // Handle youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  
  return null;
}

// Fetch YouTube video transcript using multiple methods
async function fetchYouTubeTranscript(videoId: string, youtubeApiKey?: string): Promise<{ text: string; title: string }> {
  console.log(`[Transcript] Fetching transcript for video ID: ${videoId}`);
  
  let transcript = '';
  let videoTitle = '';
  let videoDescription = '';
  
  // First, use YouTube Data API to get video title and description (most reliable)
  if (youtubeApiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`;
      const apiResp = await fetch(apiUrl);
      if (apiResp.ok) {
        const apiData = await apiResp.json();
        const snippet = apiData.items?.[0]?.snippet;
        if (snippet) {
          videoTitle = snippet.title || '';
          videoDescription = snippet.description || '';
          console.log(`[Transcript] Got title from API: ${videoTitle}`);
          console.log(`[Transcript] Got description from API: ${videoDescription.length} chars`);
        }
      } else {
        console.log(`[Transcript] YouTube API call failed: ${apiResp.status}`);
      }
    } catch (e) {
      console.warn('[Transcript] YouTube API error:', e);
    }
  }
  
  // Fallback: get video info from oEmbed if API didn't work
  if (!videoTitle) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedResp = await fetch(oembedUrl);
      if (oembedResp.ok) {
        const oembedData = await oembedResp.json();
        videoTitle = oembedData.title || '';
        console.log(`[Transcript] Video title from oEmbed: ${videoTitle}`);
      }
    } catch (e) {
      console.warn('[Transcript] Could not fetch video title from oEmbed');
    }
  }
  
  // Method 1: Fetch the watch page and extract ytInitialPlayerResponse which contains captionTracks
  try {
    console.log('[Transcript] Fetching watch page to extract captionTracks...');
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const resp = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (resp.ok) {
      const html = await resp.text();
      console.log(`[Transcript] Fetched page HTML: ${html.length} bytes`);
      
      // Extract title from page if we don't have it
      if (!videoTitle) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          videoTitle = titleMatch[1].replace(' - YouTube', '').trim();
        }
      }
      
      // Try multiple regex patterns to extract ytInitialPlayerResponse
      const playerResponsePatterns = [
        /ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script>)/s,
        /ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|let|const)/s,
        /var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/s,
        /ytInitialPlayerResponse"\s*:\s*(\{.+?\})\s*,\s*"/s,
      ];
      
      let playerResponse: any = null;
      for (const pattern of playerResponsePatterns) {
        const match = html.match(pattern);
        if (match) {
          try {
            playerResponse = JSON.parse(match[1]);
            console.log('[Transcript] Successfully parsed playerResponse');
            break;
          } catch (e) {
            console.log('[Transcript] Pattern matched but JSON parse failed, trying next...');
          }
        }
      }
      
      // Alternative: Try to find captionTracks directly in the HTML
      if (!playerResponse) {
        console.log('[Transcript] Trying direct captionTracks extraction...');
        const captionTracksMatch = html.match(/"captionTracks"\s*:\s*(\[[^\]]+\])/);
        if (captionTracksMatch) {
          try {
            const captionTracks = JSON.parse(captionTracksMatch[1]);
            playerResponse = { captions: { playerCaptionsTracklistRenderer: { captionTracks } } };
            console.log('[Transcript] Extracted captionTracks directly from HTML');
          } catch (e) {
            console.log('[Transcript] Direct captionTracks extraction failed');
          }
        }
      }
      
      if (playerResponse) {
        const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (captionTracks && captionTracks.length > 0) {
          console.log(`[Transcript] Found ${captionTracks.length} caption tracks`);
          
          // Prefer English captions, fall back to first available
          let captionTrack = captionTracks.find((t: any) => 
            t.languageCode === 'en' || t.languageCode?.startsWith('en')
          );
          if (!captionTrack) {
            captionTrack = captionTracks[0];
            console.log(`[Transcript] Using fallback caption track: ${captionTrack.languageCode}`);
          } else {
            console.log(`[Transcript] Using English caption track`);
          }
          
          // Fetch the caption XML from baseUrl
          if (captionTrack.baseUrl) {
            console.log(`[Transcript] Fetching captions from baseUrl...`);
            const captionResp = await fetch(captionTrack.baseUrl);
            if (captionResp.ok) {
              const captionXml = await captionResp.text();
              console.log(`[Transcript] Caption XML length: ${captionXml.length}`);
              // Parse XML transcript - extract text from <text> tags
              const textMatches = captionXml.match(/<text[^>]*>([^<]*)<\/text>/g);
              if (textMatches && textMatches.length > 0) {
                transcript = textMatches
                  .map(match => {
                    const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
                    // Decode HTML entities
                    return content
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&nbsp;/g, ' ')
                      .replace(/\n/g, ' ')
                      .trim();
                  })
                  .filter(Boolean)
                  .join(' ');
                console.log(`[Transcript] Extracted ${transcript.length} chars from captionTracks baseUrl`);
              }
            } else {
              console.log(`[Transcript] Caption fetch failed: ${captionResp.status}`);
            }
          }
        } else {
          console.log('[Transcript] No captionTracks in playerResponse');
        }
      } else {
        console.log('[Transcript] Could not extract playerResponse from page');
      }
      
      // Method 2: If captionTracks failed, try to extract from timedtext API
      if (!transcript || transcript.length < 50) {
        console.log('[Transcript] Trying timedtext API fallback...');
        const captionUrls = [
          `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
          `https://www.youtube.com/api/timedtext?lang=en-US&v=${videoId}`,
          `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&kind=asr`,
        ];
        
        for (const captionUrl of captionUrls) {
          try {
            const captionResp = await fetch(captionUrl);
            if (captionResp.ok) {
              const xml = await captionResp.text();
              if (xml && xml.length > 100) {
                const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g);
                if (textMatches && textMatches.length > 0) {
                  transcript = textMatches
                    .map(match => {
                      const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
                      return content
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\n/g, ' ')
                        .trim();
                    })
                    .join(' ');
                  console.log(`[Transcript] Got ${transcript.length} chars from timedtext API`);
                  break;
                }
              }
            }
          } catch (e) {
            console.warn(`[Transcript] timedtext fetch failed:`, e);
          }
        }
      }
    } else {
      console.log(`[Transcript] Watch page fetch failed: ${resp.status}`);
    }
  } catch (e) {
    console.error('[Transcript] Watch page fetch error:', e);
  }
  
  // Method 3: Fall back to video description if no transcript
  // Use the description we got from YouTube API (most reliable)
  if ((!transcript || transcript.length < 50) && videoDescription && videoDescription.length > 50) {
    console.log(`[Transcript] Using video description as fallback: ${videoDescription.length} chars`);
    transcript = `[Video Title: ${videoTitle}]\n\n[Video Description]\n${videoDescription}`;
    console.log(`[Transcript] Final fallback content: ${transcript.length} chars`);
  }
  
  return { text: transcript, title: videoTitle };
}

// Minimum transcript length to proceed with recipe extraction
const MIN_TRANSCRIPT_LENGTH = 50;

// Background image generation - runs after response is sent
async function generateRecipeImagesInBackground(
  recipeIds: { id: string; title: string; description: string | null }[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  geminiApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  
  // Generate images in parallel (max 3 at a time to avoid rate limits)
  const batchSize = 3;
  for (let i = 0; i < recipeIds.length; i += batchSize) {
    const batch = recipeIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (recipe) => {
      try {
        console.log(`Generating image for recipe: ${recipe.title}`);
        
        // Image prompt following strict guidelines
        const imagePrompt = `Professional food photography of a home-cooked ${recipe.title}. ${recipe.description || ''}
Final plated dish only. Realistic home-cooked appearance. Match the actual ingredients and portions from the recipe.
No text, no extra garnish or props not in the recipe. Natural lighting, overhead or 45-degree angle, clean simple background, appetizing presentation.
16:9 aspect ratio, high-quality food photography style.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
          generationConfig: {
            responseModalities: ['image', 'text'],
          } as any,
        });

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if ((part as any).inlineData) {
            const imageData = (part as any).inlineData;
            const base64Data = imageData.data;
            const mimeType = imageData.mimeType || 'image/png';
            const generatedImageUrl = `data:${mimeType};base64,${base64Data}`;
            
            await supabase.from('recipes').update({
              image_url: generatedImageUrl
            }).eq('id', recipe.id);
            console.log(`Image saved for: ${recipe.title}`);
            break;
          }
        }
      } catch (err) {
        console.error(`Failed to generate image for ${recipe.title}:`, err);
      }
    }));
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Capture request context for safe error handling (req body cannot be re-read in catch)
  let uploadIdForError: string | undefined;
  let seedGlobalForError = false;
  let batchModeForError = false;

  try {
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_STUDIO_GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    
    // Parse body first to check for _seedKey
    const body = await req.json();
    const { uploadId, content, sourceUrl, fileType, isImage, title, filters, seedGlobal, _seedKey, batchMode, nutritionOnly } = body;

    // Save minimal context for catch-block
    uploadIdForError = typeof uploadId === 'string' ? uploadId : undefined;
    seedGlobalForError = seedGlobal === true;
    batchModeForError = batchMode === true;
    
    // Handle nutritionOnly mode - just calculate nutrition from ingredients and return
    if (nutritionOnly === true && content) {
      console.log('Nutrition-only mode: calculating macros from ingredients');
      
      // Extract original nutrition if provided for context
      const originalNutrition = body.originalNutrition || null;
      
      const nutritionPrompt = `You are a certified nutritionist. Calculate ACCURATE macros for this recipe per serving AND generate a human-readable serving size description.

CRITICAL RULES:
1. Use USDA Food Database values as your reference
2. Be EXTREMELY precise - a medium tomato is ~22 calories, an egg is ~70 calories
3. Calculate the TOTAL recipe nutrition, then divide by servings
4. Do NOT wildly change values for small ingredient changes
${originalNutrition ? `5. Previous nutrition was: ${JSON.stringify(originalNutrition)} - only adjust proportionally for ingredient changes` : ''}

STANDARD CALORIE REFERENCES (use these!):
- 1 large egg = 70 cal, 6g protein, 0.5g carbs, 5g fat
- 1 medium tomato = 22 cal, 1g protein, 5g carbs, 0.2g fat  
- 1 slice bread = 80 cal, 3g protein, 15g carbs, 1g fat
- 1 tbsp olive oil = 120 cal, 0g protein, 0g carbs, 14g fat
- 1 tbsp butter = 100 cal, 0g protein, 0g carbs, 11g fat
- 1 medium avocado = 240 cal, 3g protein, 12g carbs, 22g fat
- 100g chicken breast = 165 cal, 31g protein, 0g carbs, 3.6g fat

SERVING SIZE DESCRIPTION RULES:
- Describe what ONE serving looks like using discrete, countable portions
- IMPORTANT: Return ONLY the description (do NOT include the prefix "1 serving =")
- Example output: "4 scrambled eggs + 1 slice keto bread with half avocado"
- Prioritize: countable pieces > volume measurements > weight
- Examples: "2 meatballs + 1 cup pasta", "1 chicken breast + 1.5 cups rice"

Recipe to analyze:
${content}

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "nutrition": {
    "calories": <integer>,
    "protein_g": <integer>,
    "carbs_g": <integer>,
    "fat_g": <integer>,
    "fiber_g": <integer>,
    "sugar_g": <integer>,
    "sodium_mg": <integer>,
    "saturated_fat_g": <integer>,
    "cholesterol_mg": <integer>
  },
  "serving_size": "<description of one serving WITHOUT the prefix '1 serving ='>"
}`;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(nutritionPrompt);
      const aiContent = result.response.text();
      
      if (!aiContent) {
        throw new Error('No response from AI');
      }
      
      try {
        const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent);
        
        console.log('AI nutrition result:', JSON.stringify(parsed.nutrition));
        console.log('AI serving_size:', parsed.serving_size);
        
        return new Response(
          JSON.stringify({
            success: true,
            nutrition: parsed.nutrition || null,
            serving_size: parsed.serving_size || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse nutrition response:', parseError);
        throw new Error('Failed to calculate nutrition');
      }
    }
    
    // Check for admin seeding access via _seedKey
    const isAdminSeed = _seedKey && _seedKey === GEMINI_API_KEY;
    
    // Also allow internal seeding via special header (for Lovable agent calls)
    const internalSeedHeader = req.headers.get('X-Lovable-Internal-Seed');
    const isInternalSeed = internalSeedHeader === 'true' && seedGlobal === true;
    
    if (!isAdminSeed && !isInternalSeed && !authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader?.replace('Bearer ', '') || '';
    
    // Check if this is a service-role request for seeding global recipes
    const isServiceRole = token === supabaseServiceKey;
    
    // Allow seeding if: service-role OR valid _seedKey OR internal seed header
    const canSeedGlobal = isServiceRole || isAdminSeed || isInternalSeed;
    
    let userId: string | null = null;
    
    if (canSeedGlobal && seedGlobal) {
      // Admin seeding access - for creating global recipes
      console.log('Admin seeding access: creating global recipes');
    } else if (isServiceRole) {
      // Service role access without seedGlobal flag
      console.log('Service role access');
    } else {
      // Regular user authentication
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader! } }
      });

      // Use getUser() to validate the token and get user info
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Authentication failed:', userError?.message || 'No user found');
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = userData.user.id;
      console.log(`Authenticated user: ${userId}`);
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== SEED GLOBAL MODE VALIDATION ==========
    // If seedGlobal is true, admin access is required and uploadId is optional
    if (seedGlobal && !canSeedGlobal) {
      console.error('Seed global mode requires admin authentication');
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: seedGlobal requires admin access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== INPUT VALIDATION ==========
    
    // 1. Validate uploadId format (UUID) - skip if seedGlobal mode OR batchMode (for YouTube bulk imports)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const skipUploadIdValidation = seedGlobal || batchMode === true;
    if (!skipUploadIdValidation && (!uploadId || typeof uploadId !== 'string' || !uuidRegex.test(uploadId))) {
      console.error('Invalid upload ID format:', uploadId);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid upload ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate content size (max 10MB for base64 content)
    const MAX_CONTENT_SIZE = 10_000_000; // 10MB
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_SIZE) {
      console.error('Content too large:', content.length);
      return new Response(
        JSON.stringify({ success: false, error: 'Content exceeds maximum size of 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate image format if isImage flag is set (MIME type + magic bytes)
    if (isImage && content) {
      const validImagePattern = /^data:image\/(jpeg|jpg|png|gif|webp|heic);base64,/i;
      if (typeof content !== 'string' || !validImagePattern.test(content)) {
        console.error('Invalid image format');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid image format. Supported: JPEG, PNG, GIF, WebP' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate magic bytes match claimed MIME type (excluding HEIC which has complex structure)
      const mimeMatch = content.match(/^data:image\/(jpeg|jpg|png|gif|webp)/i);
      if (mimeMatch) {
        const magicResult = validateMagicBytes(content, 'image');
        if (!magicResult.valid) {
          console.error(`Magic byte mismatch: claimed ${mimeMatch[1]}, detected ${magicResult.detectedType || 'unknown'}`);
          return new Response(
            JSON.stringify({ success: false, error: 'File content does not match declared image type' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 4. Validate sourceUrl format if provided
    if (sourceUrl && typeof sourceUrl === 'string') {
      try {
        const url = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        console.error('Invalid source URL:', sourceUrl);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid source URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if content is a base64-encoded document (PDF, DOCX) and validate magic bytes
    const isDocx = content && typeof content === 'string' && 
      (content.startsWith('data:application/vnd.openxmlformats') ||
       content.startsWith('data:application/msword') ||
       (content.startsWith('data:application/octet-stream') && content.includes('docx')));
    
    const isPdf = content && typeof content === 'string' && 
      content.startsWith('data:application/pdf');

    const isBase64Document = isDocx || isPdf;

    // Validate document magic bytes
    if (isPdf && content) {
      const magicResult = validateMagicBytes(content, 'pdf');
      if (!magicResult.valid) {
        console.error(`PDF magic byte mismatch: detected ${magicResult.detectedType || 'unknown'}`);
        return new Response(
          JSON.stringify({ success: false, error: 'File content does not match PDF format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isDocx && content) {
      const magicResult = validateMagicBytes(content, 'docx');
      if (!magicResult.valid) {
        console.error(`DOCX magic byte mismatch: detected ${magicResult.detectedType || 'unknown'}`);
        return new Response(
          JSON.stringify({ success: false, error: 'File content does not match DOCX format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For documents, we'll send the base64 directly to AI for processing
    // For text, validate size
    if (!isImage && !isBase64Document && content && typeof content === 'string') {
      const MAX_TEXT_SIZE = 100_000; // 100KB
      if (content.length > MAX_TEXT_SIZE) {
        console.error('Text content too large:', content.length);
        return new Response(
          JSON.stringify({ success: false, error: 'Text content exceeds maximum size of 100KB' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Processing ${seedGlobal ? 'seed global' : 'upload ' + uploadId}, isImage: ${isImage}, isDocx: ${isDocx}, isPdf: ${isPdf}`);

    // Update status to parsing (skip if seedGlobal mode)
    if (!seedGlobal && uploadId) {
      await supabase.from('uploads').update({ status: 'parsing' }).eq('id', uploadId);
    }

    // Build filter context for recipes (applies to both user-generated and seeded)
    let filterContext = '';
    if (filters) {
      if (filters.max_time) filterContext += `Max cooking time: ${filters.max_time} minutes. `;
      if (filters.meal_type) filterContext += `Meal type: ${filters.meal_type}. `;
      if (filters.cuisine) filterContext += `Cuisine: ${filters.cuisine}. `;
      if (filters.diet_type) filterContext += `Diet: ${filters.diet_type}. `;
      if (filters.allergies?.length) filterContext += `ALLERGIES (STRICT EXCLUSION): ${filters.allergies.join(', ')}. `;
      if (filters.dislikes?.length) filterContext += `DISLIKES (AVOID): ${filters.dislikes.join(', ')}. `;
      if (filters.health?.length) filterContext += `Health considerations (ENFORCE RULES): ${filters.health.join(', ')}. `;
      if (filters.target_calories) filterContext += `Target calories: ${filters.target_calories} kcal per serving. `;
      if (filters.target_protein) filterContext += `Target protein: ${filters.target_protein}g per serving. `;
      if (filters.target_carbs) filterContext += `Target carbs: ${filters.target_carbs}g per serving. `;
      if (filters.target_fat) filterContext += `Target fat: ${filters.target_fat}g per serving. `;
    }

    // UNIFIED COMPREHENSIVE SYSTEM PROMPT
    const systemPrompt = `You are an AI expert in:
- Nutrition science and metabolic health
- Professional cooking and recipe engineering
- Macro calculation and meal scaling
- Meal prep workflows
- Normalizing meals from external sources

Your job is to generate or extract complete recipes that exactly match the filters and inputs provided by the Nutrition app, including macros, diet rules, allergies, dislikes, and health considerations.

Be accurate, deterministic, and practical. No fluff.

═══════════════════════════════════════════════════════════════
SOURCE OF TRUTH RULE (CRITICAL)
═══════════════════════════════════════════════════════════════
The Nutrition app provides structured filters.
If a value is provided by a filter, you must treat it as FINAL and must NOT modify it.

Only ask a clarification question if:
- A required value is missing
- AND it is not provided by any filter
- AND it materially affects the recipe

If all required inputs are present via filters, do not ask any questions.

═══════════════════════════════════════════════════════════════
APP FILTERS (AUTHORITATIVE INPUTS)
═══════════════════════════════════════════════════════════════
${filterContext || 'No filters provided - generate reasonable healthy defaults.'}

Time (max total cooking time): < 15 / < 30 / < 45 / < 60 min
Meal Type: Breakfast, Lunch, Dinner, Snack
Cuisine: American, Italian, Mexican, Asian, Mediterranean, Indian, Japanese, Thai, French, Greek, Brazilian
Diet Type: Vegetarian, Vegan, Pescatarian, Keto, Paleo, Mediterranean

Allergies (multi-select + custom):
- Dairy, Gluten, Nuts, Peanuts, Shellfish, Soy, Eggs, Fish
- Plus any custom allergy provided
YOU MUST STRICTLY EXCLUDE ALL SELECTED ALLERGENS.

Dislikes (multi-select + custom):
- Mushrooms, Onions, Garlic, Bell Peppers, Tomatoes, Cilantro, Olives, Spicy
- Plus any custom dislikes
YOU MUST AVOID THESE INGREDIENTS ENTIRELY.

═══════════════════════════════════════════════════════════════
HEALTH OPTIMIZATION (DEFAULT BEHAVIOR)
═══════════════════════════════════════════════════════════════
Unless a specific diet/filter requires otherwise, ALWAYS optimize for health:
- MINIMIZE sodium: Use minimal added salt (1/4 to 1/2 tsp total for 4 servings MAX)
- Target sodium: < 600mg per serving, < 500mg preferred
- Use fresh herbs, garlic, lemon, spices for flavor instead of salt
- Use lean proteins when appropriate (e.g., 90/10 ground beef over 80/20)
- Target calories: 400-600 kcal per serving for main dishes unless specified otherwise
- Balance macros: 25-35g protein, 20-30g fat, 35-45g carbs per serving for balanced meals
- Include vegetables and fiber sources when possible

═══════════════════════════════════════════════════════════════
HEALTH RULES (HARD CONSTRAINTS)
═══════════════════════════════════════════════════════════════
Only tag a meal if it FULLY complies:

Low Sodium: < 300 mg sodium per serving
Kidney Friendly: < 400 mg sodium AND < 30 g protein per serving
Diabetes Friendly: ≥ 5 g fiber AND < 40 g carbs per serving
Heart Healthy: ≥ 5 g fiber AND < 300 mg sodium per serving

═══════════════════════════════════════════════════════════════
DIET RULES (STRICT COMPLIANCE FOR TAGS)
═══════════════════════════════════════════════════════════════
Keto: ≤ 8g net carbs, ≥ 60% calories from fat, ≤ 35% calories from protein
Paleo: No grains, legumes, dairy, or refined oils
Mediterranean: No red meat, processed foods, or refined grains
Vegan: No animal products
Vegetarian: No meat or fish
Pescatarian: Fish allowed, no meat

═══════════════════════════════════════════════════════════════
MACRO RULES
═══════════════════════════════════════════════════════════════
If macros or calories are provided by the app:
- Treat them as HARD CONSTRAINTS
- Macros are per serving unless explicitly stated otherwise
- Calories must match within ±2%
- Never invent or modify provided macros

If macros are NOT provided:
- Generate reasonable macros consistent with the meal type and diet
- Main dishes: 400-600 kcal, 25-35g protein per serving
- Snacks: 150-300 kcal, 5-15g protein per serving

═══════════════════════════════════════════════════════════════
SERVINGS AND MEAL PREP RULES (CRITICAL HIERARCHY)
═══════════════════════════════════════════════════════════════
This app is for MEAL PREP users who cook for the work week (Mon-Fri).
Apply this hierarchy to determine servings:

1. FIRST, LISTEN: If the chef EXPLICITLY states a number (e.g., "makes 5 bowls",
   "serves 3", "feeds 6"), use THAT EXACT NUMBER. Do not override.

2. SECOND, COUNT CONTAINERS: If the video shows the chef laying out a specific
   number of Tupperware containers (e.g., 5 or 7 containers), COUNT them and
   use that number as servings.

3. THE MEAL PREP DEFAULT: If NO number is mentioned AND NO containers are
   counted, default to 5 SERVINGS (representing a standard Mon-Fri work week).

4. SNACKS: Default to 1 serving for snacks unless otherwise specified.

5. DO NOT default to 4 servings unless the video specifically implies a
   family dinner context (e.g., "dinner for the family", "feeds my family of 4").

Every recipe MUST define serving size explicitly.

SERVING SIZE DESCRIPTION (serving_size field):
The serving_size field describes what ONE SERVING equals in terms of the COMPLETED DISH.
Be SPECIFIC with actual piece counts - avoid generic descriptions.

CRITICAL CALCULATION RULES:
1. For countable protein items (chicken tenders, wings, drumsticks, meatballs, patties, nuggets):
   - Calculate: total quantity ÷ number of servings = pieces per serving
   - Example: "1.5 lbs chicken tenders" ≈ 12 tenders total ÷ 4 servings = "3 chicken tenders"
   - Example: "16 meatballs total" ÷ 4 servings = "4 meatballs"
   - Conversion: 1 lb raw chicken tenders ≈ 6-8 tenders

2. For whole protein pieces (chicken breasts, steaks, pork chops, fish fillets):
   - Use piece count if countable: "1 chicken breast" or "1 pork chop"
   - Or use cooked weight per serving: "6 oz salmon" or "5 oz steak"

3. For non-countable items (soups, stews, rice dishes, salads):
   - Use volume: "1 cup soup" or "1.5 cups fried rice" or "1 bowl"

4. For multi-component dishes:
   - Combine protein count + sides: "3 chicken tenders + 1 cup vegetables"

DO NOT say generic things like "1 chicken breast equivalent" - be SPECIFIC.

DISCRETE FOODS RULE:
- State total units made in instructions (e.g., "Form into 16 meatballs")
- Calculate pieces per serving in serving_size (e.g., "4 meatballs")

MEAL PREP MAPPING:
- 1 container = 1 serving with explicit contents
Example: "1 container = 4 meatballs + 1 cup potatoes + 1/2 cup sauce"

═══════════════════════════════════════════════════════════════
PORTION CONTROL
═══════════════════════════════════════════════════════════════
- For meatballs/patties: 3-4 medium-sized (1.5 oz each) per serving
- For meat portions: 4-6 oz cooked per serving
- For starch portions: 1/2 to 1 cup per serving
- Main dish servings should be 400-600 kcal unless high-protein/athlete meal

═══════════════════════════════════════════════════════════════
SMART ESTIMATION FOR VAGUE MEASUREMENTS (CRITICAL)
═══════════════════════════════════════════════════════════════
When extracting recipes from Reels, social posts, or informal sources:
- If a recipe has vague measurements (e.g., "a splash," "some," "a pinch," "to taste,"
  "a drizzle," "handful," "a bit"), use your culinary knowledge to provide REALISTIC
  estimated numeric values and units based on:
  - The weight/quantity of the main protein
  - Total number of servings
  - Typical culinary ratios for that cuisine/dish type
- NEVER return null or empty values for ingredient quantities or units
- ALWAYS provide a best-estimate for every ingredient to enable accurate macro calculation

Common conversions for vague terms:
- "a splash" → 1-2 tbsp (for liquids like soy sauce, vinegar)
- "a drizzle" → 1-2 tbsp (for oils)
- "a pinch" → 1/8 tsp
- "to taste" (salt) → 1/4 tsp for 4 servings
- "some" → estimate based on dish context
- "handful" → 1/4 cup for leafy greens, 2 tbsp for nuts/seeds

═══════════════════════════════════════════════════════════════
INGREDIENT SECTIONS/CATEGORIES (MULTI-PART RECIPES)
═══════════════════════════════════════════════════════════════
For recipes with distinct parts (e.g., main dish + marinade + sauce + dressing):
- Assign each ingredient a "section" field indicating its category
- CRITICAL: If the source content (Instagram caption, video description, etc.) uses
  SPECIFIC SECTION NAMES (e.g., "Creamy Tehina", "Onion Sumac Salad", "Crispy Pita"),
  you MUST PRESERVE those exact names. Do NOT replace them with generic labels.
- CRITICAL: PRESERVE THE ORIGINAL ORDER of sections as they appear in the source content.
  List ingredients in the SAME SEQUENCE as the original recipe:
  Example: If source shows "Marinade" → "Creamy Tehina" → "Onion Sumac Salad" → "Crispy Pita",
  your ingredients array MUST follow that exact order, not alphabetical or arbitrary reordering.
- Only use generic labels ("Main", "Marinade", "Sauce", "Dressing", "Topping", "Garnish",
  "Spice Rub", "Glaze", "Filling", "Crust", "Batter") when the source does not
  specify section names.
- For simple recipes with no distinct parts, use "Main" for all ingredients
- This enables the UI to group and display ingredients under clear headings

═══════════════════════════════════════════════════════════════
EXTERNAL CONTENT INGESTION (URLs, images, documents)
═══════════════════════════════════════════════════════════════
If extracting from external content:
- Extract ingredients, cooking method, servings, and nutrition if available
- Apply SMART ESTIMATION for any vague or missing measurements
- Group ingredients by section if recipe has multiple parts
- Reconstruct missing macros based on ingredients if unavoidable
- Normalize into the standard output structure
- Validate against filters, diet rules, allergies, dislikes, and health rules
- Never copy raw content blindly

═══════════════════════════════════════════════════════════════
YOUTUBE VIDEO RECIPE GROUPING (CRITICAL)
═══════════════════════════════════════════════════════════════
SCOPE: Analyze each video individually. NEVER combine recipes from different videos.

For a SINGLE video, apply the "Is it a Meal?" test to decide grouping:

1. ONE MAIN DISH WITH PARTS → SINGLE RECIPE CARD
   If the video teaches one cohesive meal with multiple components (e.g., 'Main Protein', 'Sauce', 'Side Dish'),
   combine them into ONE recipe card. Use step headings to organize sections.
   Example: "Grilled Chicken with Chimichurri and Roasted Potatoes" = 1 recipe card
   Test: "Is the sauce meant to go ON the chicken?" → Yes → Merge into one recipe.

2. MULTIPLE DISTINCT DISHES → SEPARATE RECIPE CARDS
   If the video teaches multiple unrelated dishes (e.g., '5 Meal Prep Ideas', '3 Ways to Cook Eggs', 'Weekly Menu'),
   keep them as SEPARATE recipe cards.
   Example: "5 Easy Weeknight Dinners" = 5 separate recipe cards
   Test: "Would you eat these on the same plate at the same time?" → No → Separate cards.

THE "IS IT A MEAL?" TEST:
Before creating a new recipe card, ask: "Is this item meant to be eaten together with the previous item on the same plate?"
- If YES → Merge them into one recipe card with sections
- If NO → Start a new recipe card

Examples of MERGING (single card):
- Steak + compound butter + side vegetables
- Pasta + sauce made in the same video
- Fish + salsa or sauce topping
- Protein + accompanying grain/starch + vegetable

Examples of SEPARATING (multiple cards):
- "3 Healthy Breakfast Ideas" → 3 cards
- "Meal Prep Sunday: Chicken, Rice Bowls, and Overnight Oats" → 3 cards
- "Appetizer + Main Course + Dessert dinner party menu" → 3 cards

═══════════════════════════════════════════════════════════════
TONE AND BEHAVIOR
═══════════════════════════════════════════════════════════════
- Direct and precise
- No motivational fluff
- Never guess
- If a filter combination is impossible, explain why and stop

Always respond with valid JSON only, no markdown code blocks or explanation.`;
    
    const jsonFormat = `REQUIRED JSON structure (respond with ONLY this JSON, no markdown):
{
  "recipes": [
    {
      "title": "Recipe title",
      "description": "Brief description of the dish including what makes it special",
      "prep_time": 15,
      "cook_time": 30,
      "total_time": 45,
      "servings": 5,
      "servings_source": "Exact quote or observation explaining where serving count came from (e.g., 'Chef said: makes 5 meals', 'Counted 5 containers in video', 'Meal prep context, defaulted to 5')",
      "serving_size": "Human-readable portion description (e.g., '1 bowl', '4 meatballs + 1.5 cups potatoes', '1 cup soup', '12 oz shake')",
      "difficulty": "easy|medium|hard",
      "cuisine": "American|Italian|Mexican|Asian|Mediterranean|Indian|Japanese|Thai|French|Greek|Brazilian",
      "is_kid_friendly": false,
      "is_meal_prep_friendly": true,
      "is_budget_friendly": true,
      "ingredients": [
        { "name": "ingredient name", "quantity": 2, "unit": "cups", "aisle": "Produce|Meat|Dairy|Bakery|Canned Goods|Spices|Oils|Health Foods|Frozen|Beverages", "section": "Main|Marinade|Sauce|Dressing|Topping|Garnish|Spice Rub|Glaze|Filling" }
      ],
      "steps": [
        { "instruction": "Step 1 instruction with specific details", "introduces_section": "Main" },
        { "instruction": "Step 2 instruction including portion info for discrete items", "introduces_section": null },
        { "instruction": "Step 3 - now we start making the sauce", "introduces_section": "Sauce" }
      ],
      "nutrition": {
        "calories": 485,
        "protein_g": 28,
        "carbs_g": 38,
        "fat_g": 24,
        "fiber_g": 5,
        "sodium_mg": 500,
        "sugar_g": 6,
        "saturated_fat_g": 8,
        "cholesterol_mg": 85
      },
      "tags": ["dinner", "high-protein", "meal-prep"],
      "diet_tags": ["mediterranean"],
      "health_tags": ["diabetes-friendly"],
      "units_info": {
        "total_units": 16,
        "units_per_serving": 4,
        "unit_name": "meatballs"
      },
      "meal_prep_info": "1 container = 4 meatballs + 1 cup potatoes + 1/2 cup sauce"
    }
  ]
}

CRITICAL RULES:
1. Extract ALL recipes from the document
2. Extract EVERY ingredient with exact quantities - NEVER leave quantity or unit null
3. If vague measurements found (e.g., "a splash", "some", "to taste"), ESTIMATE realistic values
4. Calculate ACCURATE nutrition per serving (calories ±2%)
5. SERVINGS RULE (CRITICAL - DO NOT IGNORE):
   - FIRST: If the chef explicitly states a number (e.g., "makes 5 bowls", "serves 3", "5 meals"), use THAT EXACT NUMBER
   - SECOND: If the video shows containers being filled, COUNT them and use that number
   - THIRD: If "meal prep" is mentioned but no number given, DEFAULT TO 5 (Mon-Fri work week)
   - NEVER default to 4 unless the chef specifically says "family of 4" or "4 servings"
   - DO NOT calculate servings from ingredient weight - LISTEN to the chef
6. For countable items (meatballs, patties, etc), include units_info
7. Only add diet_tags and health_tags if recipe FULLY complies with rules
8. Include serving_size as a human-readable portion description
9. MINIMIZE sodium by default (< 600mg unless health filter requires lower)
10. If no recipes found, return: { "recipes": [], "error": "Could not extract recipe information" }
11. Include "servings_source" field with the exact quote or observation that determined the serving count
12. Assign each ingredient a "section" field (e.g., "Main", "Marinade", "Sauce") for multi-part recipes
13. STEP SECTION PLACEMENT (CRITICAL FOR UI):
    - Each step can optionally have an "introduces_section" field
    - Set "introduces_section" to the section name ONLY for the FIRST step where that section's ingredients are actually used
    - DO NOT default "Main" to step 1. Place each section (including "Main") on the EXACT step where those ingredients are first used.
    - If step 1 says "mix all marinade ingredients", set introduces_section: "Marinade" (NOT "Main")
    - If step 2 says "Place onion half, insert skewers, thread chicken", set introduces_section: "Main" because that's when the main ingredients (onion, chicken) are first used
    - Example: If step 6 says "Meanwhile, whisk tehina ingredients", set introduces_section: "Creamy Tehina"
    - Example: If step 7 says "Toss onion salad ingredients together", set introduces_section: "Onion Sumac Salad"
    - For steps that don't introduce a new section, set introduces_section: null
    - This tells the UI exactly when to show the section header with its ingredients`;


    // Build prompt and call Gemini
    let promptText = '';
    let imageParts: any[] = [];
    let modelName = 'gemini-2.0-flash'; // Default to flash for text
    
    if (isImage && content && content.startsWith('data:image/')) {
      // For images, use vision capabilities
      modelName = 'gemini-2.0-flash';
      const mimeMatch = content.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const base64Data = content.replace(/^data:image\/[^;]+;base64,/, '');
      
      imageParts = [{
        inlineData: {
          mimeType,
          data: base64Data
        }
      }];
      promptText = `${systemPrompt}\n\nExtract ALL recipe information from this image.\n\n${jsonFormat}`;
    } else if (isDocx && content) {
      // For DOCX files, extract text first
      console.log('Extracting text from DOCX file...');
      const extractedText = await extractTextFromDocx(content);
      console.log(`Extracted text preview: ${extractedText.substring(0, 500)}...`);
      
      promptText = `${systemPrompt}\n\nExtract ALL recipes from the following document content.\n\n${jsonFormat}\n\nDocument content:\n${extractedText}`;
    } else if (isPdf && content) {
      // For PDFs, extract base64 and send to Gemini
      modelName = 'gemini-2.0-flash';
      const base64Data = content.replace(/^data:application\/pdf;base64,/, '');
      
      imageParts = [{
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      }];
      promptText = `${systemPrompt}\n\nThis is a PDF document containing recipes. Extract ALL recipes from it.\n\n${jsonFormat}`;
    } else if (sourceUrl && !content) {
      // Check if this is a YouTube channel or playlist
      const youtubeType = isYouTubeChannelOrPlaylist(sourceUrl);
      const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
      
      if (youtubeType && YOUTUBE_API_KEY) {
        // Handle YouTube channel or playlist
        console.log(`Processing YouTube ${youtubeType}: ${sourceUrl}`);
        
        let videoUrls: string[] = [];
        
        if (youtubeType === 'channel') {
          const channelId = await getYouTubeChannelId(sourceUrl, YOUTUBE_API_KEY);
          if (channelId) {
            console.log(`Resolved channel ID: ${channelId}`);
            videoUrls = await getChannelVideos(channelId, YOUTUBE_API_KEY, 20);
          } else {
            console.warn('Could not resolve YouTube channel ID');
          }
        } else if (youtubeType === 'playlist') {
          const playlistMatch = sourceUrl.match(YOUTUBE_PLAYLIST_PATTERN);
          if (playlistMatch?.[2]) {
            videoUrls = await getPlaylistVideos(playlistMatch[2], YOUTUBE_API_KEY, 20);
          }
        }
        
        if (videoUrls.length === 0) {
          throw new Error(`Could not find any videos in the YouTube ${youtubeType}. Make sure the channel/playlist is public.`);
        }
        
        console.log(`Found ${videoUrls.length} videos to process`);
        
        const videoList = videoUrls.slice(0, 10).map((url, i) => `Video ${i + 1}: ${url}`).join('\n');
        promptText = `${systemPrompt}\n\nProcess these YouTube cooking videos and extract ALL recipes from each video. Pay close attention to the EXACT ingredients and quantities mentioned in each video.\n\n${jsonFormat}\n\nVideos to process:\n${videoList}`;
      } else if (youtubeType && !YOUTUBE_API_KEY) {
        throw new Error('YouTube channel/playlist import requires the YOUTUBE_API_KEY to be configured.');
      } else {
        // Check if this is a single YouTube video URL
        const isYouTubeVideoUrl = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(sourceUrl);
        
        if (isYouTubeVideoUrl) {
          // Extract video ID and fetch transcript
          const videoId = extractVideoId(sourceUrl);
          if (!videoId) {
            throw new Error('Could not extract video ID from YouTube URL');
          }
          
          console.log(`[YouTube] Processing single video: ${sourceUrl} (ID: ${videoId})`);
          
          // Fetch transcript (pass YouTube API key for description fallback)
          const { text: transcript, title: videoTitle } = await fetchYouTubeTranscript(videoId, YOUTUBE_API_KEY);
          
          // Log first 100 chars for debugging
          console.log(`[YouTube] Transcript preview (first 100 chars): "${transcript.substring(0, 100)}"`);
          console.log(`[YouTube] Transcript length: ${transcript.length} chars`);
          
          // Validate transcript/description is not empty
          if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
            const errorMsg = `Could not retrieve video content. The video may not have captions or a description with recipe information. Content length: ${transcript?.length || 0} chars.`;
            console.error(`[YouTube] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          promptText = `${systemPrompt}

═══════════════════════════════════════════════════════════════
YOUTUBE VIDEO CONTEXT
═══════════════════════════════════════════════════════════════
Video Title: ${videoTitle || 'Unknown'}
Video URL: ${sourceUrl}

IMPORTANT: Extract recipes ONLY from this specific video's transcript below.
Do NOT invent or hallucinate recipes. If no recipe is clearly described in the transcript, return:
{ "recipes": [], "error": "No recipe found in video transcript" }

${jsonFormat}

VIDEO TRANSCRIPT:
${transcript}`;
        } else {
          // For regular URLs, fetch the actual webpage content first
          console.log(`Fetching recipe from URL: ${sourceUrl}`);
          let webpageContent = '';
          const instagram = isInstagramUrl(sourceUrl);
          
          try {
            const fetchResponse = await fetchWithRetry(sourceUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
            }, instagram ? 4 : 2);
            
            if (fetchResponse.ok) {
              const rawHtml = await fetchResponse.text();
              console.log(`Fetched ${rawHtml.length} characters from URL`);

              if (instagram) {
                const ogDescription = extractOgDescriptionFromHtml(rawHtml);
                if (ogDescription) {
                  // Keep this tiny to reduce TPM usage when calling Gemini.
                  const clipped = ogDescription.slice(0, 8000);
                  webpageContent = `Instagram URL: ${sourceUrl}\n\nOG Description (caption/summary):\n${clipped}`;
                  console.log(`Instagram og:description extracted (${clipped.length} chars)`);
                } else {
                  // Fallback: do NOT send full Instagram HTML (too large and noisy).
                  webpageContent = `Instagram URL: ${sourceUrl}\n\n(Unable to extract og:description from HTML)`;
                  console.warn('Instagram og:description meta tag not found');
                }
              } else {
                // Clean HTML to reduce token usage
                webpageContent = rawHtml
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<!--[\s\S]*?-->/g, '')
                  .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                  .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                  .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                  .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
                  .substring(0, 150000);
                
                console.log(`Cleaned HTML to ${webpageContent.length} characters`);
              }
            } else {
              console.warn(`Failed to fetch URL: ${fetchResponse.status}`);
              webpageContent = `URL: ${sourceUrl} (could not fetch content, status: ${fetchResponse.status})`;
            }
          } catch (fetchErr) {
            console.warn('Error fetching URL:', fetchErr);
            webpageContent = `URL: ${sourceUrl} (could not fetch content)`;
          }
          
          promptText = `${systemPrompt}\n\nExtract ALL recipes from the following webpage content. Pay close attention to the EXACT ingredients listed on the page.\n\n${jsonFormat}\n\nWebpage from ${sourceUrl}:\n${webpageContent}`;
        }
      }
    } else {
      // For text content
      promptText = `${systemPrompt}\n\nExtract ALL recipes from the following content.\n\n${jsonFormat}\n\nContent:\n${content || 'No content provided'}`;
    }
    
    console.log(`Calling Gemini with model: ${modelName}`);
    const aiStartTime = Date.now();
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    let result;
    try {
      if (imageParts.length > 0) {
        result = await model.generateContent([promptText, ...imageParts]);
      } else {
        result = await model.generateContent(promptText);
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('AI request timed out. Please try with a smaller file or simpler recipe.');
      }
      throw fetchError;
    }

    console.log(`AI response received in ${Date.now() - aiStartTime}ms`);

    const aiContent = result.response.text();
    
    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI response preview:', aiContent.substring(0, 300));

    // Parse the JSON response
    let parsedRecipes;
    try {
      let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedRecipes = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!parsedRecipes || !Array.isArray(parsedRecipes.recipes)) {
      console.error('Invalid AI response structure:', JSON.stringify(parsedRecipes).substring(0, 200));
      throw new Error('Invalid AI response: missing recipes array');
    }

    // For seedGlobal mode, we don't need an upload record
    let ownerUserId: string | null = null;
    
    if (seedGlobal) {
      ownerUserId = null;
      console.log('Seed global mode: creating global recipes with no owner');
    } else if (batchMode) {
      // In batchMode (YouTube bulk imports), skip upload lookup and use authenticated user directly
      ownerUserId = userId;
      console.log(`Batch mode: using authenticated user ${userId} as owner`);
    } else {
      // Get the upload to find owner
      const { data: upload } = await supabase
        .from('uploads')
        .select('owner_user_id')
        .eq('id', uploadId)
        .single();

      if (!upload) {
        throw new Error('Upload not found');
      }

      // ========== OWNERSHIP VERIFICATION ==========
      if (upload.owner_user_id !== userId) {
        console.error(`Ownership mismatch: upload owner ${upload.owner_user_id} vs authenticated user ${userId}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden: You do not own this upload' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      ownerUserId = upload.owner_user_id;
    }

    console.log(`Found ${parsedRecipes.recipes.length} recipes to save`);

    // Save all recipes in parallel for speed
    const recipePromises = parsedRecipes.recipes.map(async (recipe: any) => {
      if (!recipe.title || typeof recipe.title !== 'string') {
        console.warn('Skipping recipe with invalid title');
        return null;
      }
      
      // Sanitize fields
      const sanitizedTitle = recipe.title.trim().substring(0, 200);
      const sanitizedDescription = typeof recipe.description === 'string' 
        ? recipe.description.trim().substring(0, 1000) 
        : null;
      const sanitizedCuisine = typeof recipe.cuisine === 'string'
        ? recipe.cuisine.trim().substring(0, 50)
        : null;
      
      // Log serving source for debugging
      const servingsSource = recipe.servings_source || 'Not specified';
      console.log(`[SERVINGS DEBUG] Recipe "${recipe.title}": servings=${recipe.servings}, source="${servingsSource}"`);
      
      const sanitizedServings = (typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 100)
        ? Math.round(recipe.servings) : 5; // Default to 5 for meal prep (Mon-Fri)
      const sanitizedPrepTime = (typeof recipe.prep_time === 'number' && recipe.prep_time >= 0 && recipe.prep_time <= 1440)
        ? Math.round(recipe.prep_time) : null;
      const sanitizedCookTime = (typeof recipe.cook_time === 'number' && recipe.cook_time >= 0 && recipe.cook_time <= 1440)
        ? Math.round(recipe.cook_time) : null;
      const sanitizedTotalTime = (typeof recipe.total_time === 'number' && recipe.total_time >= 0 && recipe.total_time <= 2880)
        ? Math.round(recipe.total_time) : ((sanitizedPrepTime || 0) + (sanitizedCookTime || 0)) || null;
      
      const validDifficulties = ['easy', 'medium', 'hard'];
      const sanitizedDifficulty = validDifficulties.includes(recipe.difficulty) ? recipe.difficulty : 'medium';

      const sanitizedServingSize = typeof recipe.serving_size === 'string'
        ? recipe.serving_size.trim().substring(0, 100)
        : null;
      
      // Sanitize source_url for storage
      const sanitizedSourceUrl = (typeof sourceUrl === 'string' && sourceUrl.trim())
        ? sourceUrl.trim().substring(0, 2000)
        : null;

      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          owner_user_id: ownerUserId,
          title: sanitizedTitle,
          description: sanitizedDescription,
          prep_time: sanitizedPrepTime,
          cook_time: sanitizedCookTime,
          total_time: sanitizedTotalTime,
          servings: sanitizedServings,
          serving_size: sanitizedServingSize,
          difficulty: sanitizedDifficulty,
          cuisine: sanitizedCuisine,
          scope: seedGlobal ? 'global' : 'private',
          is_kid_friendly: typeof recipe.is_kid_friendly === 'boolean' ? recipe.is_kid_friendly : false,
          is_meal_prep_friendly: typeof recipe.is_meal_prep_friendly === 'boolean' ? recipe.is_meal_prep_friendly : false,
          is_budget_friendly: typeof recipe.is_budget_friendly === 'boolean' ? recipe.is_budget_friendly : false,
          source_url: sanitizedSourceUrl,
        })
        .select()
        .single();

      if (recipeError) {
        console.error('Error creating recipe:', recipeError);
        return null;
      }

      // Insert related data in parallel
      const relatedPromises = [];

      // Ingredients
      if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        const validIngredients = recipe.ingredients
          .filter((ing: any) => ing && typeof ing.name === 'string' && ing.name.trim())
          .slice(0, 100)
          .map((ing: any, idx: number) => ({
            recipe_id: newRecipe.id,
            name: ing.name.trim().substring(0, 200),
            quantity: (typeof ing.quantity === 'number' && ing.quantity >= 0 && ing.quantity <= 10000) ? ing.quantity : null,
            unit: typeof ing.unit === 'string' ? ing.unit.trim().substring(0, 50) : null,
            order_index: idx,
            section: typeof ing.section === 'string' ? ing.section.trim().substring(0, 50) : 'Main',
          }));
        
        if (validIngredients.length > 0) {
          relatedPromises.push(supabase.from('recipe_ingredients').insert(validIngredients));
        }
      }

      // Steps - now with introduces_section support
      if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
        const validSteps = recipe.steps
          .map((step: any, idx: number) => {
            // Handle both string steps (legacy) and object steps (new format with introduces_section)
            const instruction = typeof step === 'string' 
              ? step.trim() 
              : (typeof step?.instruction === 'string' ? step.instruction.trim() : '');
            
            if (!instruction) return null;
            
            const introducesSection = typeof step === 'object' && typeof step.introduces_section === 'string' 
              ? step.introduces_section.trim().substring(0, 50) 
              : null;
            
            return {
              recipe_id: newRecipe.id,
              step_number: idx + 1,
              instruction: instruction.substring(0, 2000),
              introduces_section: introducesSection,
            };
          })
          .filter((step: any) => step !== null)
          .slice(0, 50);
        
        if (validSteps.length > 0) {
          relatedPromises.push(supabase.from('recipe_steps').insert(validSteps));
        }
      }

      // Nutrition
      const validateNutrition = (val: any, max: number): number | null => {
        if (typeof val === 'number' && val >= 0 && val <= max) {
          return Math.round(val * 10) / 10;
        }
        return null;
      };
      
      relatedPromises.push(supabase.from('recipe_nutrition').insert({
        recipe_id: newRecipe.id,
        calories: validateNutrition(recipe.nutrition?.calories, 10000),
        protein_g: validateNutrition(recipe.nutrition?.protein_g, 1000),
        carbs_g: validateNutrition(recipe.nutrition?.carbs_g, 1000),
        fat_g: validateNutrition(recipe.nutrition?.fat_g, 1000),
        fiber_g: validateNutrition(recipe.nutrition?.fiber_g, 500),
        sodium_mg: validateNutrition(recipe.nutrition?.sodium_mg, 50000),
      }));

      // Tags - combine general tags, diet_tags, and health_tags
      const allTags: { recipe_id: string; tag_type: string; tag_value: string }[] = [];
      
      if (Array.isArray(recipe.tags)) {
        recipe.tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 20)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'meal',
              tag_value: tag.trim().substring(0, 50),
            });
          });
      }
      
      if (Array.isArray(recipe.diet_tags)) {
        recipe.diet_tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 10)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'diet',
              tag_value: tag.trim().toLowerCase().substring(0, 50),
            });
          });
      }
      
      if (Array.isArray(recipe.health_tags)) {
        recipe.health_tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim())
          .slice(0, 10)
          .forEach((tag: string) => {
            allTags.push({
              recipe_id: newRecipe.id,
              tag_type: 'health',
              tag_value: tag.trim().toLowerCase().substring(0, 50),
            });
          });
      }
      
      if (allTags.length > 0) {
        relatedPromises.push(supabase.from('recipe_tags').insert(allTags));
      }

      // Link upload to recipe (skip for seedGlobal mode)
      if (!seedGlobal && uploadId) {
        relatedPromises.push(supabase.from('upload_recipe_links').insert({
          upload_id: uploadId,
          recipe_id: newRecipe.id,
        }));
      }

      await Promise.all(relatedPromises);
      
      return { id: newRecipe.id, title: sanitizedTitle, description: sanitizedDescription };
    });

    const results = await Promise.all(recipePromises);
    const createdRecipes = results.filter(r => r !== null) as { id: string; title: string; description: string | null }[];

    console.log(`Successfully saved ${createdRecipes.length} recipes in ${Date.now() - aiStartTime}ms total`);

    // Update upload status (skip for seedGlobal mode)
    if (!seedGlobal && uploadId) {
      const recipesCount = createdRecipes.length;
      if (recipesCount === 1 && createdRecipes[0]?.title) {
        await supabase.from('uploads').update({
          status: 'parsed',
          parsed_text: aiContent,
          file_name: createdRecipes[0].title,
        }).eq('id', uploadId);
      } else {
        await supabase.from('uploads').update({
          status: 'parsed',
          parsed_text: aiContent,
        }).eq('id', uploadId);
      }
    }

    // Generate images in background AFTER returning response
    // This runs for all imports including batch mode (YouTube channels/playlists)
    if (createdRecipes.length > 0) {
      EdgeRuntime.waitUntil(
        generateRecipeImagesInBackground(createdRecipes, supabaseUrl, supabaseServiceKey, GEMINI_API_KEY)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipes: createdRecipes,
        count: createdRecipes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error parsing recipe:', errorMessage);

    const isRateLimit =
      /\[429\s/i.test(errorMessage) ||
      /too many requests/i.test(errorMessage) ||
      /quota exceeded/i.test(errorMessage);

    const statusCode = isRateLimit ? 429 : 500;
    
    try {
      // Only update upload status when this request actually had an uploadId (not batchMode YouTube imports)
      if (!seedGlobalForError && uploadIdForError) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('uploads').update({
          status: 'failed',
          error_message: errorMessage,
        }).eq('id', uploadIdForError);
      }
    } catch (e) {
      console.error('Failed to update upload status:', e);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
