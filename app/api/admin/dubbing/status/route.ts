import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { getEpisodeWithTrack } from '@/lib/dubbing/store';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get('episodeId');
  const lang = searchParams.get('lang');
  if (!episodeId || !lang) {
    return NextResponse.json({ error: 'Se requieren episodeId y lang' }, { status: 400 });
  }

  try {
    const { track } = await getEpisodeWithTrack(episodeId, lang);
    const totalCount = track.segments.length;
    const pendingCount = track.segments.filter((s) => s.status === 'pending').length;
    const translatedCount = track.segments.filter((s) => s.status === 'translated').length;
    const synthesizedCount = track.segments.filter((s) => s.status === 'synthesized').length;
    const errorCount = track.segments.filter((s) => s.status === 'error').length;

    return NextResponse.json({
      status: track.status,
      progress: track.progress,
      totalCount,
      pendingCount,
      translatedCount,
      synthesizedCount,
      errorCount,
      maxDriftSeconds: track.maxDriftSeconds,
      url: track.url,
      error: track.error,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Pista de doblaje no encontrada' }, { status: 404 });
  }
}
