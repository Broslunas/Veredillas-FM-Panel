import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { getDeepgramAdminStats } from '@/lib/deepgram';

export async function GET(request: Request) {
  try {
    const { authorized, user } = await isAuthorizedAdmin(request);

    if (!authorized || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Strict role check: ONLY admin and owner
    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Acceso denegado. Esta página y sus datos están restringidos a Administradores y Propietarios (Owner).' },
        { status: 403 }
      );
    }

    const statsData = await getDeepgramAdminStats();

    return NextResponse.json({
      success: true,
      currentUserRole: user.role,
      data: statsData,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/deepgram/stats:', error);
    return NextResponse.json(
      { error: error.message || 'Error al recuperar estadísticas de Deepgram' },
      { status: 500 }
    );
  }
}
