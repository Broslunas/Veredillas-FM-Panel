import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { updateYouTubePlaylist, deleteYouTubePlaylist, addVideoToYouTubePlaylist } from '@/lib/youtube';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, privacyStatus } = body;
    if (!title) return NextResponse.json({ error: 'Título obligatorio' }, { status: 400 });

    await updateYouTubePlaylist(id, title, description || '', privacyStatus || 'public');
    return NextResponse.json({ success: true, message: 'Lista de reproducción actualizada en YouTube.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar lista' }, { status: 500 });
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
    return NextResponse.json({ success: true, message: 'Vídeo añadido a la lista de reproducción.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al añadir vídeo a la lista' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    await deleteYouTubePlaylist(id);
    return NextResponse.json({ success: true, message: 'Lista de reproducción eliminada de YouTube.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al eliminar lista' }, { status: 500 });
  }
}
