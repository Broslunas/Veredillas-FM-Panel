import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { createResumableUploadSession } from '@/lib/youtube';

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, tags, categoryId, privacyStatus, mimeType, fileSize } = body;

    if (!title || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'Título, tipo MIME y tamaño de archivo son obligatorios.' },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') || '';

    const uploadUrl = await createResumableUploadSession({
      title,
      description: description || '',
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : [],
      categoryId: categoryId || '22',
      privacyStatus: privacyStatus || 'unlisted',
      mimeType,
      fileSize: Number(fileSize),
      origin,
    });

    return NextResponse.json({ uploadUrl });
  } catch (err: any) {
    console.error('Error al crear sesión de subida a YouTube:', err);
    return NextResponse.json(
      { error: err.message || 'Error al iniciar la sesión de subida en YouTube' },
      { status: 500 }
    );
  }
}
