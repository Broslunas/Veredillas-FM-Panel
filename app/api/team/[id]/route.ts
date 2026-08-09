import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/Team';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
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
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    await dbConnect();

    const member = await Team.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!member) {
      return NextResponse.json({ error: 'Miembro del equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el miembro del equipo' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const member = await Team.findByIdAndDelete(id);
  if (!member) {
    return NextResponse.json({ error: 'Miembro del equipo no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Miembro del equipo eliminado correctamente' });
}
