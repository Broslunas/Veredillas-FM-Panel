import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import {
  getYouTubePlaylistItems,
  addVideoToYouTubePlaylist,
  reorderYouTubePlaylistItem,
  removeYouTubePlaylistItem,
} from '@/lib/youtube';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const items = await getYouTubePlaylistItems(id);
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al obtener elementos de la playlist' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { videoId } = body;
    if (!videoId) return NextResponse.json({ error: 'ID del vídeo es obligatorio' }, { status: 400 });

    await addVideoToYouTubePlaylist(id, videoId);
    return NextResponse.json({ success: true, message: 'Vídeo añadido a la playlist' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al añadir vídeo a la playlist' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { playlistItemId, videoId, position } = body;
    if (!playlistItemId || !videoId || position === undefined) {
      return NextResponse.json({ error: 'playlistItemId, videoId y position son obligatorios' }, { status: 400 });
    }

    await reorderYouTubePlaylistItem(playlistItemId, id, videoId, position);
    return NextResponse.json({ success: true, message: 'Elemento reordenado en la playlist' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al reordenar elemento en la playlist' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const playlistItemId = searchParams.get('playlistItemId');

  if (!playlistItemId) {
    return NextResponse.json({ error: 'Se requiere el parámetro playlistItemId' }, { status: 400 });
  }

  try {
    await removeYouTubePlaylistItem(playlistItemId);
    return NextResponse.json({ success: true, message: 'Vídeo eliminado de la playlist' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al quitar vídeo de la playlist' }, { status: 500 });
  }
}
