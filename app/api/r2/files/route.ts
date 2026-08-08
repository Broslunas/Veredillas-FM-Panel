import { NextResponse } from 'next/server';
import { listR2Files, deleteR2File } from '@/lib/r2';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || '';

  const files = await listR2Files(prefix);
  return NextResponse.json({ files });
}

export async function DELETE(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const { key } = await request.json();
    if (!key) {
      return NextResponse.json({ error: 'Key de archivo no proporcionada' }, { status: 400 });
    }

    const success = await deleteR2File(key);
    if (!success) {
      return NextResponse.json({ error: 'No se pudo eliminar el archivo de R2' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Archivo eliminado correctamente de R2' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar archivo' }, { status: 500 });
  }
}
