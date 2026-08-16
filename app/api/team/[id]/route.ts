import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/Team';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const member = await Team.findById(id);
  if (!member) {
    return NextResponse.json({ error: 'Miembro del equipo no encontrado' }, { status: 404 });
  }

  return NextResponse.json(member);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    await dbConnect();

    const before = await Team.findById(id).lean();
    const member = await Team.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!member) {
      return NextResponse.json({ error: 'Miembro del equipo no encontrado' }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'team',
      resourceId: id,
      label: member.name,
      changes: buildFieldChanges(before, data, Object.keys(data)),
    });

    return NextResponse.json(member);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el miembro del equipo' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const member = await Team.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  if (!member) {
    return NextResponse.json({ error: 'Miembro del equipo no encontrado' }, { status: 404 });
  }

  await logAudit({
    actor: user,
    action: 'delete',
    resource: 'team',
    resourceId: id,
    label: member.name,
  });

  return NextResponse.json({ success: true, message: 'Miembro del equipo movido a la papelera' });
}
