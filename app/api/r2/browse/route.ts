import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import { listR2FolderContents } from '@/lib/r2';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get('bucket');
  const prefix = searchParams.get('prefix') || '';
  const continuationToken = searchParams.get('continuationToken') || undefined;

  if (!bucket) {
    return NextResponse.json({ error: 'Falta el parámetro bucket' }, { status: 400 });
  }

  try {
    const result = await listR2FolderContents(bucket, prefix, continuationToken);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error browsing R2 bucket:', error);
    return NextResponse.json({ error: error.message || 'Error al explorar el bucket' }, { status: 500 });
  }
}
