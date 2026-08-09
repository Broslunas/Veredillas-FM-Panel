/**
 * YouTube API v3 Integration Helper
 * Handles OAuth 2.0 token refresh, Resumable Upload sessions, channel stats, video management,
 * playlists, comment moderation, live broadcasting, and subtitles.
 */

export interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  viewCount: string;
  likeCount: string;
  commentCount: string;
  durationSeconds: number;
  durationFormatted: string;
  videoType: 'short' | 'normal';
}

export interface YouTubePlaylistItem {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
  thumbnail: string;
}

export interface YouTubeCommentThreadItem {
  id: string;
  videoId?: string;
  authorName: string;
  authorProfileImage: string;
  textDisplay: string;
  publishedAt: string;
  likeCount: number;
}

export interface YouTubeLiveBroadcastItem {
  id: string;
  title: string;
  scheduledStartTime: string;
  lifeCycleStatus: string;
  streamName?: string;
  rtmpUrl?: string;
}

export interface CreateUploadSessionParams {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  mimeType: string;
  fileSize: number;
  origin?: string;
}

/**
 * Parses ISO 8601 duration string (e.g. PT3M45S, PT45S, PT1H12M) into seconds and formatted string.
 */
export function parseISO8601Duration(durationStr: string): { seconds: number; formatted: string } {
  const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = durationStr ? durationStr.match(regex) : null;
  if (!matches) return { seconds: 0, formatted: '00:00' };

  const days = parseInt(matches[1] || '0', 10);
  const hours = parseInt(matches[2] || '0', 10);
  const minutes = parseInt(matches[3] || '0', 10);
  const seconds = parseInt(matches[4] || '0', 10);

  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;

  let formatted = '';
  if (hours > 0 || days > 0) {
    const totalHours = days * 24 + hours;
    formatted = `${totalHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return { seconds: totalSeconds, formatted };
}

/**
 * Resolves YouTube credentials from environment variables.
 * Falls back to GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET if YOUTUBE_* are not set.
 */
export function getYouTubeCredentials(): {
  credentials: YouTubeCredentials | null;
  missing: string[];
} {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || '';

  const missing: string[] = [];
  if (!clientId) missing.push('YOUTUBE_CLIENT_ID / GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('YOUTUBE_CLIENT_SECRET / GOOGLE_CLIENT_SECRET');
  if (!refreshToken) missing.push('YOUTUBE_REFRESH_TOKEN');

  if (missing.length > 0) {
    return { credentials: null, missing };
  }

  return {
    credentials: { clientId, clientSecret, refreshToken },
    missing: [],
  };
}

/**
 * Obtains a fresh access_token using the YOUTUBE_REFRESH_TOKEN.
 */
export async function getFreshAccessToken(): Promise<string> {
  const { credentials, missing } = getYouTubeCredentials();
  if (!credentials) {
    throw new Error(`Faltan credenciales en .env.local: ${missing.join(', ')}`);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || 'No se pudo obtener el token de acceso de Google OAuth.'
    );
  }

  return data.access_token as string;
}

/**
 * Fetches current connected YouTube channel info.
 */
export async function getYouTubeChannelInfo(): Promise<YouTubeChannelInfo> {
  const accessToken = await getFreshAccessToken();

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await res.json();
  if (!res.ok || !data.items || data.items.length === 0) {
    throw new Error('No se encontró información del canal de YouTube asociado.');
  }

  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    customUrl: channel.snippet.customUrl,
    thumbnail: channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.high?.url,
    subscriberCount: channel.statistics?.subscriberCount,
    videoCount: channel.statistics?.videoCount,
    viewCount: channel.statistics?.viewCount,
  };
}

/**
 * Fetches videos uploaded to the YouTube channel with statistics, duration, and pagination support.
 */
export async function getYouTubeVideos(
  maxResults = 50,
  pageToken = ''
): Promise<{
  videos: YouTubeVideoItem[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
}> {
  const accessToken = await getFreshAccessToken();

  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const channelData = await channelRes.json();
  if (!channelRes.ok || !channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads) {
    throw new Error('No se pudo obtener la lista de subidas del canal.');
  }

  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  let allVideoIds: string[] = [];
  let nextToken: string | undefined = pageToken || undefined;
  let prevToken: string | undefined = undefined;
  let totalRes = 0;

  const targetLimit = maxResults > 0 ? maxResults : 200;

  do {
    const fetchLimit = Math.min(targetLimit - allVideoIds.length, 50);
    const pageTokenParam = nextToken ? `&pageToken=${nextToken}` : '';
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${fetchLimit}${pageTokenParam}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const playlistData = await playlistRes.json();
    if (!playlistRes.ok || !playlistData.items || playlistData.items.length === 0) {
      break;
    }

    if (!prevToken && playlistData.prevPageToken) {
      prevToken = playlistData.prevPageToken;
    }

    const ids = playlistData.items
      .map((item: any) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
      .filter(Boolean);

    allVideoIds.push(...ids);
    nextToken = playlistData.nextPageToken;
    totalRes = playlistData.pageInfo?.totalResults || allVideoIds.length;

  } while (nextToken && allVideoIds.length < targetLimit && (maxResults > 50 || maxResults === 0));

  if (allVideoIds.length === 0) return { videos: [], totalResults: 0 };

  const videoItems: YouTubeVideoItem[] = [];

  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${batch.join(',')}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const videosData = await videosRes.json();
    if (videosRes.ok && videosData.items) {
      const parsed = videosData.items.map((vid: any): YouTubeVideoItem => {
        const rawDuration = vid.contentDetails?.duration || 'PT0S';
        const { seconds, formatted } = parseISO8601Duration(rawDuration);
        const videoType = seconds > 0 && seconds <= 60 ? 'short' : 'normal';

        return {
          id: vid.id,
          title: vid.snippet.title,
          description: vid.snippet.description,
          publishedAt: vid.snippet.publishedAt,
          thumbnail:
            vid.snippet.thumbnails?.high?.url ||
            vid.snippet.thumbnails?.medium?.url ||
            vid.snippet.thumbnails?.default?.url,
          privacyStatus: vid.status?.privacyStatus || 'unlisted',
          viewCount: vid.statistics?.viewCount || '0',
          likeCount: vid.statistics?.likeCount || '0',
          commentCount: vid.statistics?.commentCount || '0',
          durationSeconds: seconds,
          durationFormatted: formatted,
          videoType,
        };
      });
      videoItems.push(...parsed);
    }
  }

  return {
    videos: videoItems,
    nextPageToken: nextToken,
    prevPageToken: prevToken,
    totalResults: totalRes,
  };
}

/**
 * Updates a YouTube video's metadata (title, description, privacyStatus).
 */
export async function updateYouTubeVideo(
  videoId: string,
  title: string,
  description: string,
  privacyStatus: 'public' | 'unlisted' | 'private'
): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const getRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const getData = await getRes.json();
  const existingCategory = getData.items?.[0]?.snippet?.categoryId || '22';

  const body = {
    id: videoId,
    snippet: {
      title,
      description,
      categoryId: existingCategory,
    },
    status: {
      privacyStatus,
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/videos?part=snippet,status',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al actualizar vídeo en YouTube: ${errText}`);
  }
}

/**
 * Deletes a video from YouTube.
 */
export async function deleteYouTubeVideo(videoId: string): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al eliminar vídeo de YouTube: ${errText}`);
  }
}

/**
 * Playlists API
 */
export async function getYouTubePlaylists(): Promise<YouTubePlaylistItem[]> {
  const accessToken = await getFreshAccessToken();

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await res.json();
  if (!res.ok || !data.items) {
    return [];
  }

  return data.items.map((pl: any): YouTubePlaylistItem => ({
    id: pl.id,
    title: pl.snippet.title,
    description: pl.snippet.description,
    itemCount: pl.contentDetails?.itemCount || 0,
    privacyStatus: pl.status?.privacyStatus || 'public',
    thumbnail: pl.snippet.thumbnails?.high?.url || pl.snippet.thumbnails?.default?.url || '',
  }));
}

export async function createYouTubePlaylist(
  title: string,
  description: string,
  privacyStatus: 'public' | 'unlisted' | 'private'
): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const body = {
    snippet: { title, description },
    status: { privacyStatus },
  };

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al crear lista de reproducción: ${errText}`);
  }
}

export async function updateYouTubePlaylist(
  playlistId: string,
  title: string,
  description: string,
  privacyStatus: 'public' | 'unlisted' | 'private'
): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const body = {
    id: playlistId,
    snippet: { title, description },
    status: { privacyStatus },
  };

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al actualizar lista de reproducción: ${errText}`);
  }
}

export async function deleteYouTubePlaylist(playlistId: string): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?id=${playlistId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al eliminar lista de reproducción: ${errText}`);
  }
}

export async function addVideoToYouTubePlaylist(
  playlistId: string,
  videoId: string
): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const body = {
    snippet: {
      playlistId,
      resourceId: {
        kind: 'youtube#video',
        videoId,
      },
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al añadir vídeo a la playlist: ${errText}`);
  }
}

/**
 * Comments & Moderation API
 */
export async function getYouTubeCommentThreads(): Promise<YouTubeCommentThreadItem[]> {
  const accessToken = await getFreshAccessToken();

  const channel = await getYouTubeChannelInfo();

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${channel.id}&maxResults=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await res.json();
  if (!res.ok || !data.items) {
    return [];
  }

  return data.items.map((thread: any): YouTubeCommentThreadItem => {
    const topComment = thread.snippet.topLevelComment.snippet;
    return {
      id: thread.id,
      videoId: thread.snippet.videoId,
      authorName: topComment.authorDisplayName,
      authorProfileImage: topComment.authorProfileImageUrl,
      textDisplay: topComment.textDisplay,
      publishedAt: topComment.publishedAt,
      likeCount: topComment.likeCount || 0,
    };
  });
}

export async function replyYouTubeComment(parentId: string, text: string): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const body = {
    snippet: {
      parentId,
      textOriginal: text,
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/comments?part=snippet',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al responder al comentario: ${errText}`);
  }
}

export async function deleteYouTubeComment(commentId: string): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/comments?id=${commentId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al eliminar comentario: ${errText}`);
  }
}

/**
 * Live Broadcasts API
 */
export async function getYouTubeLiveBroadcasts(): Promise<YouTubeLiveBroadcastItem[]> {
  const accessToken = await getFreshAccessToken();

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails&broadcastStatus=all&maxResults=25',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await res.json();
  if (!res.ok || !data.items) {
    return [];
  }

  return data.items.map((bc: any): YouTubeLiveBroadcastItem => ({
    id: bc.id,
    title: bc.snippet.title,
    scheduledStartTime: bc.snippet.scheduledStartTime,
    lifeCycleStatus: bc.status.lifeCycleStatus,
  }));
}

export async function scheduleYouTubeLiveBroadcast(
  title: string,
  description: string,
  scheduledStartTime: string
): Promise<{ broadcastId: string; streamName: string; rtmpUrl: string }> {
  const accessToken = await getFreshAccessToken();

  const bRes = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          scheduledStartTime,
        },
        status: {
          privacyStatus: 'public',
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
        },
      }),
    }
  );

  const bData = await bRes.json();
  if (!bRes.ok || !bData.id) {
    throw new Error(`Error al crear la emisión en directo: ${JSON.stringify(bData)}`);
  }

  const broadcastId = bData.id;

  const sRes = await fetch(
    'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { title: `Stream para ${title}` },
        cdn: {
          frameRate: 'variable',
          ingestionType: 'rtmp',
          resolution: 'variable',
        },
      }),
    }
  );

  const sData = await sRes.json();
  if (!sRes.ok || !sData.id) {
    throw new Error(`Error al crear la clave de streaming: ${JSON.stringify(sData)}`);
  }

  const streamId = sData.id;
  const streamName = sData.cdn?.ingestionInfo?.streamName || '';
  const rtmpUrl = sData.cdn?.ingestionInfo?.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2';

  await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&part=snippet,contentDetails&streamId=${streamId}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return { broadcastId, streamName, rtmpUrl };
}

/**
 * Initiates a Resumable Upload session for a YouTube Video.
 * Returns the Google resumable upload URL.
 */
export async function createResumableUploadSession(
  params: CreateUploadSessionParams
): Promise<string> {
  const accessToken = await getFreshAccessToken();

  const body = {
    snippet: {
      title: params.title,
      description: params.description,
      tags: params.tags || [],
      categoryId: params.categoryId || '22',
    },
    status: {
      privacyStatus: params.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': params.fileSize.toString(),
        ...(params.origin ? { Origin: params.origin } : {}),
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al iniciar la sesión de subida en YouTube: ${response.status} - ${errorText}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube no devolvió el encabezado Location (URL de subida reanudable).');
  }

  return uploadUrl;
}

/**
 * Uploads custom video thumbnail to YouTube.
 */
export async function setYouTubeVideoThumbnail(
  videoId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<void> {
  const accessToken = await getFreshAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(imageBuffer),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al establecer la miniatura en YouTube: ${errorText}`);
  }
}
