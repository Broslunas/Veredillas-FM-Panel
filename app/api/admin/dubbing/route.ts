import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { getBucketByType, deleteR2Prefix, deleteR2File } from '@/lib/r2';
import { getEpisodeWithTrack, removeTrack } from '@/lib/dubbing/store';

export async function DELETE(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { episodeId, lang } = await request.json();
    if (!episodeId || !lang) {
      return NextResponse.json({ error: 'Se requieren episodeId y lang' }, { status: 400 });
    }

    const { track } = await getEpisodeWithTrack(episodeId, lang);

    const bucket = await getBucketByType('multimedia');
    if (bucket) {
      await deleteR2Prefix(bucket.bucketName, `dubs-tmp/${episodeId}/${lang}/`);
      if (track.status === 'ready' && track.key) {
        await deleteR2File(track.key, track.bucket || bucket.bucketName);
      }
    }

    await removeTrack(episodeId, lang);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/dubbing:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar la pista de doblaje' }, { status: 500 });
  }
}
