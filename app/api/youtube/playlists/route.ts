import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { getYouTubePlaylists, createYouTubePlaylist } from '@/lib/youtube';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const playlists = await getYouTubePlaylists();
    return NextResponse.json({ playlists });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al obtener listas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, privacyStatus } = body;
    if (!title) return NextResponse.json({ error: 'Título obligatorio' }, { status: 400 });

    await createYouTubePlaylist(title, description || '', privacyStatus || 'public');
    return NextResponse.json({ success: true, message: 'Lista de reproducción creada en YouTube.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al crear lista' }, { status: 500 });
  }
}
