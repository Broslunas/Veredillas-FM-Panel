import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Guest from '@/models/Guest';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  await dbConnect();
  const filter: any = { deletedAt: null };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { role: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }

  const guests = await Guest.find(filter).sort({ createdAt: -1 });
  return NextResponse.json(guests);
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const guest = await Guest.create(data);

    await logAudit({
      actor: user,
      action: 'create',
      resource: 'guest',
      resourceId: guest._id.toString(),
      label: guest.name,
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al crear el invitado' }, { status: 400 });
  }
}
