import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import { transcribeMedia, listAuraVoices } from '@/lib/deepgram';
import { buildDubBlocks } from '@/lib/dubbing/segmentation';
import { mapSpeakersToVoices } from '@/lib/dubbing/voices';
import { resolveSpeakerNames } from '@/lib/dubbing/speakerNames';
import { addTrack } from '@/lib/dubbing/store';

export const maxDuration = 120;

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang, label } = await request.json();
    if (!episodeId || !lang || !label) {
      return NextResponse.json({ error: 'Se requieren episodeId, lang y label' }, { status: 400 });
    }

    await dbConnect();
    const episode = await EpisodeContent.findById(episodeId).lean<any>();
    if (!episode) {
      return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
    }

    const existing = (episode.dubs || []).find((d: any) => d.lang === lang);
    if (existing && existing.status !== 'error') {
      return NextResponse.json(
        { error: `Ya existe una pista de doblaje para "${lang}" (estado: ${existing.status})` },
        { status: 409 }
      );
    }

    // Prefer the VIDEO as the transcription source whenever one exists. Playback syncs
    // the dub track against `video.currentTime` (see NetflixPlayer's dubAudioRef sync
    // effects), so if a standalone audioUrl release has a different intro/edit length
    // than the video, transcribing the audio would anchor every timestamp to the wrong
    // reference and the whole dub would be offset from the very first second.
    const sourceUrl = episode.videoUrl || episode.audioUrl;
    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'El episodio no tiene audioUrl ni videoUrl del que partir' },
        { status: 400 }
      );
    }

    // Re-transcribe rather than reusing episode.transcription: that field only stores a
    // single display timestamp per line (no end time), not precise enough to anchor
    // dubbing blocks to the original audio's real timing.
    const transcript = await transcribeMedia(sourceUrl, {
      model: 'nova-3',
      language: 'es',
      diarize: true,
      punctuate: true,
      smartFormat: true,
    });

    const blocks = buildDubBlocks(transcript);
    if (blocks.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo extraer ningún bloque de audio para doblar' },
        { status: 422 }
      );
    }

    const speakerIds = Array.from(new Set(blocks.map((b) => b.speaker ?? 0)));
    const voices = await listAuraVoices();
    const voiceMap = mapSpeakersToVoices(speakerIds, voices, lang);
    // Borrow names already assigned in the episode's saved transcript (Speaker
    // Identification panel) so the voice picker shows "Pablo"/"Marta" instead of
    // generic "Hablante 1"/"Hablante 2".
    const speakerNames = resolveSpeakerNames(blocks, episode.transcription);

    const now = new Date();
    const track = {
      lang,
      label,
      status: 'awaiting_voices' as const,
      progress: 0,
      sourceDuration: transcript.metadata?.duration || blocks[blocks.length - 1].end,
      segments: blocks.map((b) => ({
        index: b.index,
        start: b.start,
        end: b.end,
        speaker: b.speaker ?? 0,
        text: b.text,
        status: 'pending' as const,
      })),
      voiceMap,
      speakerNames,
      createdAt: now,
      updatedAt: now,
    };

    await addTrack(episodeId, track as any);

    return NextResponse.json({ lang, totalSegments: blocks.length, speakerIds, voiceMap, speakerNames });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/start:', error);
    return NextResponse.json({ error: error.message || 'Error al iniciar el doblaje' }, { status: 500 });
  }
}
