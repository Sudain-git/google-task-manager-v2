/**
 * YouTube Data API Utility
 * Fetches video metadata (duration, title, channel)
 */

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Format ISO 8601 duration to readable format
 * Examples: PT43S → "43 sec", PT7M → "7 min", PT1H15M → "1 hour 15 min"
 */
export function formatDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) return '0 sec';
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  if (hours > 0) {
    // 1+ hours: "1 hour 15 min"
    return minutes > 0 ? `${hours} hour ${minutes} min` : `${hours} hour`;
  } else if (minutes > 0) {
    // 1-59 minutes: "7 min"
    return `${minutes} min`;
  } else {
    // < 1 minute: "43 sec"
    return `${seconds} sec`;
  }
}

/**
 * Fetch video metadata from YouTube API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - { title, channelTitle, duration }
 */
export async function getVideoMetadata(videoId) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = data.items[0];
    
    return {
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      duration: formatDuration(video.contentDetails.duration),
      videoId: videoId
    };
  } catch (error) {
    console.error('[YouTubeAPI] Failed to fetch video metadata:', error);
    throw error;
  }
}

/**
 * Extract playlist ID from various YouTube playlist URL formats
 * Handles:
 * - youtube.com/playlist?list=PLxxxxx
 * - youtube.com/watch?v=xxx&list=PLxxxxx
 */
export function extractPlaylistId(url) {
  if (!url) return null;

  // Match ?list=PLxxxxx or &list=PLxxxxx
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch all video IDs from a YouTube playlist
 * Uses YouTube Data API v3 playlistItems endpoint
 * Handles pagination (50 items per page max)
 * Returns array of video URLs
 */
export async function getPlaylistVideos(playlistId) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const videos = [];
  let nextPageToken = null;

  do {
    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', YOUTUBE_API_KEY);
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.items) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) {
        videos.push(`https://www.youtube.com/watch?v=${videoId}`);
      }
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos;
}

/**
 * Batch fetch video metadata for multiple videos
 * YouTube API allows up to 50 video IDs per request
 */
export async function getBatchVideoMetadata(videoIds) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const BATCH_SIZE = 50;
  const results = [];
  
  // Process in batches of 50
  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items) {
        data.items.forEach(video => {
          results.push({
            videoId: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            duration: formatDuration(video.contentDetails.duration)
          });
        });
      }
    } catch (error) {
      console.error('[YouTubeAPI] Failed to fetch batch:', error);
      // Continue with other batches even if one fails
    }
  }
  
  return results;
}