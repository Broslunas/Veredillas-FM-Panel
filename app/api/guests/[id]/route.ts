import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Guest from '@/models/Guest';
import { isAuthorizedAdmin } from '@/lib/api-guard';

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
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    await dbConnect();

    const guest = await Guest.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!guest) {
      return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
    }

    return NextResponse.json(guest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el invitado' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const guest = await Guest.findByIdAndDelete(id);
  if (!guest) {
    return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Invitado eliminado correctamente' });
}
