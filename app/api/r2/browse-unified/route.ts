import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import { listUnifiedFolderContents } from '@/lib/r2';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || '';
  const tokensParam = searchParams.get('tokens');

  let continuationTokens: Record<string, string> = {};
  if (tokensParam) {
    try {
      continuationTokens = JSON.parse(tokensParam);
    } catch {
      return NextResponse.json({ error: 'Parámetro tokens inválido' }, { status: 400 });
    }
  }

  try {
    const result = await listUnifiedFolderContents(prefix, continuationTokens);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error browsing unified R2 storage:', error);
    return NextResponse.json(
      { error: error.message || 'Error al explorar el almacenamiento unificado' },
      { status: 500 }
    );
  }
}
