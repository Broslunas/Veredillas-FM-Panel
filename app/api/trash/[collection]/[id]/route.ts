import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import BlogPost from '@/models/BlogPost';
import Guest from '@/models/Guest';
import Team from '@/models/Team';
import { isAuthorizedAdmin, isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';

const COLLECTION_MODELS: Record<string, any> = {
  episodes: EpisodeContent,
  blog: BlogPost,
  guests: Guest,
  team: Team,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { collection, id } = await params;
  const Model = COLLECTION_MODELS[collection];
  if (!Model) {
    return NextResponse.json({ error: 'Colección no válida' }, { status: 400 });
  }

  await dbConnect();

  const doc = await Model.findByIdAndUpdate(id, { deletedAt: null }, { new: true });
  if (!doc) {
    return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Elemento restaurado correctamente' });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { collection, id } = await params;
  const Model = COLLECTION_MODELS[collection];
  if (!Model) {
    return NextResponse.json({ error: 'Colección no válida' }, { status: 400 });
  }

  await dbConnect();

  const doc = await Model.findByIdAndDelete(id);
  if (!doc) {
    return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Elemento eliminado definitivamente' });
}
