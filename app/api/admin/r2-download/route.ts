import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getR2ObjectByUrl } from '@/lib/r2';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  }

  try {
    const { stream, contentType, contentLength } = await getR2ObjectByUrl(url);
    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
      },
    });
  } catch (error: any) {
    console.error('Error downloading R2 object:', error);
    return NextResponse.json({ error: error.message || 'Error al descargar el archivo desde R2' }, { status: 500 });
  }
}
