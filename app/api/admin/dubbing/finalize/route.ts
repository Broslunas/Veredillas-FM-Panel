import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import { getBucketByType, getS3ClientForBucket, uploadFileToR2, deleteR2Prefix } from '@/lib/r2';
import { parseWav, createDubTimelinePlacer, encodeMonoPcmToMp3, DEFAULT_DUB_SAMPLE_RATE } from '@/lib/dubbing/audio';
import { getEpisodeWithTrack, saveTrack } from '@/lib/dubbing/store';

export const maxDuration = 300;

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
    const client = getS3ClientForBucket(bucket);

    const totalDuration =
      track.sourceDuration || synthesized[synthesized.length - 1].end + 5;
    const placer = createDubTimelinePlacer(DEFAULT_DUB_SAMPLE_RATE, totalDuration);

    for (const segment of synthesized) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket.bucketName, Key: segment.tempKey! })
      );
      const bytes = await (response.Body as any).transformToByteArray();
      const parsed = parseWav(Buffer.from(bytes));
      placer.place(segment.index, segment.start, parsed.samples);
    }

    const { pcm, maxDriftSeconds, placements } = placer.finish();
    const placementByIndex = new Map(placements.map((p) => [p.index, p]));

    const mp3Buffer = encodeMonoPcmToMp3(pcm, DEFAULT_DUB_SAMPLE_RATE, 128);

    await dbConnect();
    const episode = await EpisodeContent.findById(episodeId).lean<any>();
    const baseName = `${episode?.slug || episodeId}-dub-${lang}`;

    const uploaded = await uploadFileToR2(mp3Buffer, `${baseName}.mp3`, 'audio/mpeg', 'audios/dubs', 'audio', baseName);

    await deleteR2Prefix(bucket.bucketName, `dubs-tmp/${episodeId}/${lang}/`);

    track.segments = track.segments.map((s) => {
      const placement = placementByIndex.get(s.index);
      return placement ? { ...s, actualStart: placement.actualStart, actualEnd: placement.actualEnd } : s;
    });
    track.status = 'ready';
    track.progress = 100;
    track.url = uploaded.url;
    track.bucket = uploaded.bucket;
    track.key = uploaded.key;
    track.duration = pcm.length / DEFAULT_DUB_SAMPLE_RATE;
    track.maxDriftSeconds = maxDriftSeconds;
    track.updatedAt = new Date();

    await saveTrack(episodeId, lang, track);

    return NextResponse.json({
      url: uploaded.url,
      duration: track.duration,
      maxDriftSeconds,
      skippedSegments,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/dubbing/finalize:', error);
    return NextResponse.json({ error: error.message || 'Error al finalizar el doblaje' }, { status: 500 });
  }
}
