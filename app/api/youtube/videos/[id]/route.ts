import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { updateYouTubeVideo, deleteYouTubeVideo } from '@/lib/youtube';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, privacyStatus } = body;

    if (!title) {
      return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 });
    }

    await updateYouTubeVideo(id, title, description || '', privacyStatus || 'unlisted');

    return NextResponse.json({ success: true, message: 'Vídeo actualizado correctamente en YouTube.' });
  } catch (err: any) {
    console.error('Error al actualizar vídeo en YouTube:', err);
    return NextResponse.json(
      { error: err.message || 'Error al actualizar el vídeo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteYouTubeVideo(id);
    return NextResponse.json({ success: true, message: 'Vídeo eliminado de YouTube.' });
  } catch (err: any) {
    console.error('Error al eliminar vídeo de YouTube:', err);
    return NextResponse.json(
      { error: err.message || 'Error al eliminar el vídeo' },
      { status: 500 }
    );
  }
}
