import { NextResponse } from 'next/server';
import { listR2Files, deleteR2File, renameR2File, deleteR2Prefix } from '@/lib/r2';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function GET(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || '';

  const files = await listR2Files(prefix);
  return NextResponse.json({ files });
}

export async function DELETE(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const { key, prefix, bucket } = await request.json();
    if (!key && !prefix) {
      return NextResponse.json({ error: 'Key o prefix no proporcionado' }, { status: 400 });
    }

    if (prefix) {
      if (!bucket) {
        return NextResponse.json({ error: 'Bucket no proporcionado para borrar carpeta' }, { status: 400 });
      }
      const success = await deleteR2Prefix(bucket, prefix);
      if (!success) {
        return NextResponse.json({ error: 'No se pudo eliminar la carpeta de R2' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Carpeta eliminada correctamente de R2' });
    }

    const success = await deleteR2File(key, bucket);
    if (!success) {
      return NextResponse.json({ error: 'No se pudo eliminar el archivo de R2' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Archivo eliminado correctamente de R2' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar archivo' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const { key, bucket, newKey } = await request.json();

    if (!key || !bucket || !newKey) {
      return NextResponse.json({ error: 'Key, bucket o nuevo nombre no proporcionado' }, { status: 400 });
    }

    const success = await renameR2File(bucket, key, newKey);
    if (!success) {
      return NextResponse.json({ error: 'No se pudo renombrar el archivo en R2' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Archivo renombrado correctamente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al renombrar archivo' }, { status: 500 });
  }
}
