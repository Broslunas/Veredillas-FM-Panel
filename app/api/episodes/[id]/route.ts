import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const episode = await EpisodeContent.findById(id);
  if (!episode) {
    return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
  }

  return NextResponse.json(episode);
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

    const episode = await EpisodeContent.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!episode) {
      return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
    }

    return NextResponse.json(episode);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el episodio' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const episode = await EpisodeContent.findByIdAndDelete(id);
  if (!episode) {
    return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Episodio eliminado correctamente' });
}
