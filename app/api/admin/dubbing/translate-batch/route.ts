import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { translateDubSegments } from '@/lib/gemini';
import { getEpisodeWithTrack, saveTrack } from '@/lib/dubbing/store';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang, batchSize = 25 } = await request.json();
    if (!episodeId || !lang) {
      return NextResponse.json({ error: 'Se requieren episodeId y lang' }, { status: 400 });
    }

    const { track } = await getEpisodeWithTrack(episodeId, lang);
    const totalCount = track.segments.length;

    const pending = track.segments.filter((s) => s.status === 'pending').slice(0, batchSize);

    if (pending.length > 0) {
      const translations = await translateDubSegments(
        pending.map((s) => s.text),
        track.label
      );

      const byIndex = new Map(pending.map((s, i) => [s.index, translations[i] ?? s.text]));
      track.segments = track.segments.map((s) =>
        byIndex.has(s.index) ? { ...s, translatedText: byIndex.get(s.index), status: 'translated' } : s
      );
    }

    const translatedCount = track.segments.filter((s) => s.status !== 'pending').length;
    const done = translatedCount === totalCount;

    track.progress = Math.round((translatedCount / totalCount) * 30);
    if (done) track.status = 'synthesizing';
    track.updatedAt = new Date();

    await saveTrack(episodeId, lang, track);

    return NextResponse.json({ batchCount: pending.length, translatedCount, totalCount, done });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/translate-batch:', error);
    return NextResponse.json({ error: error.message || 'Error al traducir el lote' }, { status: 500 });
  }
}
