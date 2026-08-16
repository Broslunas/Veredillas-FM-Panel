import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import BlogPost from '@/models/BlogPost';
import Guest from '@/models/Guest';
import Team from '@/models/Team';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';

const COLLECTION_MODELS: Record<string, any> = {
  episodes: EpisodeContent,
  blog: BlogPost,
  guests: Guest,
  team: Team,
};

const RESOURCE_NAMES: Record<string, string> = {
  episodes: 'episode',
  blog: 'blog',
  guests: 'guest',
  team: 'team',
};

function labelFor(doc: any): string {
  return doc?.title || doc?.name || doc?._id?.toString() || '';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
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

  await logAudit({
    actor: user,
    action: 'restore',
    resource: RESOURCE_NAMES[collection] || collection,
    resourceId: id,
    label: labelFor(doc),
  });

  return NextResponse.json({ success: true, message: 'Elemento restaurado correctamente' });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  // Restoring is enough for editors; wiping an item for good stays admin-only
  // regardless of the permissions granted on the Papelera section.
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json(
      { error: 'Solo administradores pueden eliminar definitivamente' },
      { status: 403 }
    );
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

  await logAudit({
    actor: user,
    action: 'permanent_delete',
    resource: RESOURCE_NAMES[collection] || collection,
    resourceId: id,
    label: labelFor(doc),
  });

  return NextResponse.json({ success: true, message: 'Elemento eliminado definitivamente' });
}
