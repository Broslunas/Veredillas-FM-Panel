import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { getEpisodeWithTrack, saveTrack } from '@/lib/dubbing/store';

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang, voiceMap } = await request.json();
    if (!episodeId || !lang || !voiceMap || typeof voiceMap !== 'object') {
      return NextResponse.json({ error: 'Se requieren episodeId, lang y voiceMap' }, { status: 400 });
    }

    const { track } = await getEpisodeWithTrack(episodeId, lang);

    if (track.status === 'finalizing' || track.status === 'ready') {
      return NextResponse.json(
        { error: 'Ya no se pueden cambiar las voces: el doblaje ya se ha sintetizado' },
        { status: 409 }
      );
    }

    const speakerIds = Array.from(new Set(track.segments.map((s) => String(s.speaker ?? 0))));
    const missing = speakerIds.filter((id) => !voiceMap[id]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Falta asignar una voz para el/los hablante(s): ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    track.voiceMap = voiceMap;
    if (track.status === 'awaiting_voices') {
      track.status = 'translating';
    }
    track.updatedAt = new Date();

    await saveTrack(episodeId, lang, track);

    return NextResponse.json({ success: true, status: track.status });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/set-voices:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar las voces' }, { status: 500 });
  }
}
