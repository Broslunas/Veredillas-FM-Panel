import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getYouTubeCredentials, getYouTubeChannelInfo } from '@/lib/youtube';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { credentials, missing } = getYouTubeCredentials();
  if (!credentials) {
    return NextResponse.json({
      configured: false,
      missing,
      channel: null,
    });
  }

  try {
    const channel = await getYouTubeChannelInfo();
    return NextResponse.json({
      configured: true,
      missing: [],
      channel,
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: false,
      missing: [],
      error: err.message || 'Error al conectar con la API de YouTube',
    });
  }
}
