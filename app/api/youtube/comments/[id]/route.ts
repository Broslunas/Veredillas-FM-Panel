import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { deleteYouTubeComment } from '@/lib/youtube';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    await deleteYouTubeComment(id);
    return NextResponse.json({ success: true, message: 'Comentario eliminado de YouTube.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al eliminar comentario' }, { status: 500 });
  }
}
