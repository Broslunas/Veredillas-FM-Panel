import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedRoute(request);
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
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    await dbConnect();

    const before = await EpisodeContent.findById(id).lean();
    const episode = await EpisodeContent.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!episode) {
      return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'episode',
      resourceId: id,
      label: episode.title,
      changes: buildFieldChanges(before, data, Object.keys(data)),
    });

    return NextResponse.json(episode);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el episodio' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const episode = await EpisodeContent.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  if (!episode) {
    return NextResponse.json({ error: 'Episodio no encontrado' }, { status: 404 });
  }

  await logAudit({
    actor: user,
    action: 'delete',
    resource: 'episode',
    resourceId: id,
    label: episode.title,
  });

  return NextResponse.json({ success: true, message: 'Episodio movido a la papelera' });
}
