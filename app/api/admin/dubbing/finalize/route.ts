import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getBucketByType, buildPublicUrl } from '@/lib/r2';
import { getEpisodeWithTrack } from '@/lib/dubbing/store';

export const maxDuration = 30;

/**
 * Lightweight "prepare" step for finalizing a dub: just resolves each synthesized
 * segment's temp WAV to a public URL and hands the ordered list back to the client.
 * The actual heavy lifting (downloading segments, placing them on the timeline,
 * encoding the final MP3) now runs in the browser — see components/DubbingManager.tsx
 * — so this function never has to hold a whole episode's PCM in memory, which is what
 * previously forced a raised Vercel function memory limit unavailable on the Hobby plan.
 */
export async function POST(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang } = await request.json();
    if (!episodeId || !lang) {
      return NextResponse.json({ error: 'Se requieren episodeId y lang' }, { status: 400 });
    }

    const { track } = await getEpisodeWithTrack(episodeId, lang);

    const unfinished = track.segments.filter((s) => s.status === 'pending' || s.status === 'translated');
    if (unfinished.length > 0) {
      return NextResponse.json(
        { error: `Aún hay ${unfinished.length} segmento(s) sin sintetizar` },
        { status: 400 }
      );
    }

    const synthesized = track.segments
      .filter((s) => s.status === 'synthesized' && s.tempKey)
      .sort((a, b) => a.index - b.index);

    if (synthesized.length === 0) {
      return NextResponse.json({ error: 'No hay ningún segmento sintetizado que ensamblar' }, { status: 400 });
    }

    const skippedSegments = track.segments
      .filter((s) => s.status === 'error')
      .map((s) => ({ index: s.index, error: s.error }));

    const bucket = await getBucketByType('multimedia');
    if (!bucket) {
      return NextResponse.json({ error: 'No hay bucket "multimedia" configurado en R2' }, { status: 500 });
    }

    const segments = synthesized.map((s) => ({
      index: s.index,
      start: s.start,
      url: buildPublicUrl(bucket, s.tempKey!),
    }));

    const sourceDuration = track.sourceDuration || synthesized[synthesized.length - 1].end + 5;

    return NextResponse.json({ segments, sourceDuration, skippedSegments });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/finalize:', error);
    return NextResponse.json({ error: error.message || 'Error al preparar el ensamblaje' }, { status: 500 });
  }
}
