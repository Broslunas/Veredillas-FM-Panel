import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Guest from '@/models/Guest';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const guest = await Guest.findById(id);
  if (!guest) {
    return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
  }

  return NextResponse.json(guest);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    await dbConnect();

    const before = await Guest.findById(id).lean();
    const guest = await Guest.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!guest) {
      return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'guest',
      resourceId: id,
      label: guest.name,
      changes: buildFieldChanges(before, data, Object.keys(data)),
    });

    return NextResponse.json(guest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el invitado' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const guest = await Guest.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  if (!guest) {
    return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
  }

  await logAudit({
    actor: user,
    action: 'delete',
    resource: 'guest',
    resourceId: id,
    label: guest.name,
  });

  return NextResponse.json({ success: true, message: 'Invitado movido a la papelera' });
}
