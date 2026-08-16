import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { resolveR2ObjectFromUrl } from '@/lib/r2';
import { getEpisodeWithTrack, saveTrack } from '@/lib/dubbing/store';

export const maxDuration = 30;

interface PlacementInput {
  index: number;
  actualStart: number;
  actualEnd: number;
}

/**
 * Persists the result of a client-assembled dub: the browser has already placed every
 * segment on the timeline, encoded the final MP3, and uploaded it straight to R2 via a
 * presigned URL (see lib/r2-client.ts). This route just records that outcome — small
 * JSON body only, no file ever passes through it.
 */
export async function POST(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang, url, duration, maxDriftSeconds, placements } = await request.json();
    if (!episodeId || !lang || !url || typeof duration !== 'number') {
      return NextResponse.json({ error: 'Se requieren episodeId, lang, url y duration' }, { status: 400 });
    }

    const { track } = await getEpisodeWithTrack(episodeId, lang);
    const { bucket, key } = await resolveR2ObjectFromUrl(url);

    const placementByIndex = new Map<number, PlacementInput>(
      Array.isArray(placements) ? placements.map((p: PlacementInput) => [p.index, p]) : []
    );

    track.segments = track.segments.map((s) => {
      const placement = placementByIndex.get(s.index);
      return placement ? { ...s, actualStart: placement.actualStart, actualEnd: placement.actualEnd } : s;
    });
    track.status = 'ready';
    track.progress = 100;
    track.url = url;
    track.bucket = bucket.bucketName;
    track.key = key;
    track.duration = duration;
    track.maxDriftSeconds = typeof maxDriftSeconds === 'number' ? maxDriftSeconds : undefined;
    track.updatedAt = new Date();

    await saveTrack(episodeId, lang, track);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/finalize-complete:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar el doblaje finalizado' }, { status: 500 });
  }
}
