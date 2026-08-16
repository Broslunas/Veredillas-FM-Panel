import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { getYouTubeCommentThreads, replyYouTubeComment } from '@/lib/youtube';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const comments = await getYouTubeCommentThreads();
    return NextResponse.json({ comments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al obtener comentarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { parentId, text } = body;
    if (!parentId || !text) {
      return NextResponse.json({ error: 'ID del comentario padre y respuesta son obligatorios' }, { status: 400 });
    }

    await replyYouTubeComment(parentId, text);
    return NextResponse.json({ success: true, message: 'Respuesta publicada en YouTube.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al responder comentario' }, { status: 500 });
  }
}
