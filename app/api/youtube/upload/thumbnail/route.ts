import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { setYouTubeVideoThumbnail } from '@/lib/youtube';

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const videoId = formData.get('videoId') as string;
    const file = formData.get('thumbnail') as File | null;

    if (!videoId || !file) {
      return NextResponse.json(
        { error: 'Se requiere ID del vídeo y archivo de miniatura.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await setYouTubeVideoThumbnail(videoId, buffer, file.type || 'image/jpeg');

    return NextResponse.json({ success: true, message: 'Miniatura establecida correctamente en YouTube.' });
  } catch (err: any) {
    console.error('Error al subir miniatura a YouTube:', err);
    return NextResponse.json(
      { error: err.message || 'Error al establecer la miniatura' },
      { status: 500 }
    );
  }
}
