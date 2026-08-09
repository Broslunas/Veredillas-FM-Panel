import { NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/r2';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No se ha adjuntado ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileToR2(buffer, file.name, file.type || 'application/octet-stream', folder);

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      fileName: file.name,
      size: file.size,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error('Error uploading file to R2:', error);
    return NextResponse.json(
      { error: error.message || 'Error al subir el archivo a Cloudflare R2' },
      { status: 500 }
    );
  }
}
