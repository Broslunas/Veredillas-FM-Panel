import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import ActiveListener from '@/models/ActiveListener';

export async function GET(request: Request) {
  try {
    const { authorized } = await isAuthorizedRoute(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();

    // Active listeners in the last 5 minutes
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const listeners = await ActiveListener.find({
      lastSeen: { $gt: threshold },
    }).sort({ lastSeen: -1 }).lean();

    return NextResponse.json({
      listeners,
      count: listeners.length,
    });
  } catch (error: any) {
    console.error('Error fetching active listeners:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor', listeners: [], count: 0 },
      { status: 500 }
    );
  }
}
