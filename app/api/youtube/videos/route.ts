import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getYouTubeVideos } from '@/lib/youtube';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageToken = searchParams.get('pageToken') || '';
  const maxResults = Number(searchParams.get('maxResults')) || 50;

  try {
    const data = await getYouTubeVideos(maxResults, pageToken);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error al obtener vídeos de YouTube:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener la lista de vídeos' },
      { status: 500 }
    );
  }
}
