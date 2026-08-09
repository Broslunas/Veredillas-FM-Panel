import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getYouTubeLiveBroadcasts, scheduleYouTubeLiveBroadcast } from '@/lib/youtube';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const broadcasts = await getYouTubeLiveBroadcasts();
    return NextResponse.json({ broadcasts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al obtener emisiones en directo' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, scheduledStartTime } = body;
    if (!title || !scheduledStartTime) {
      return NextResponse.json({ error: 'Título y fecha/hora programada son obligatorios' }, { status: 400 });
    }

    const liveData = await scheduleYouTubeLiveBroadcast(title, description || '', scheduledStartTime);
    return NextResponse.json({ success: true, ...liveData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al programar directo' }, { status: 500 });
  }
}
