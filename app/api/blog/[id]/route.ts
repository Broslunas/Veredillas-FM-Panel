import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BlogPost from '@/models/BlogPost';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const post = await BlogPost.findById(id);
  if (!post) {
    return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
  }

  return NextResponse.json(post);
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

    const before = await BlogPost.findById(id).lean();
    const post = await BlogPost.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!post) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'blog',
      resourceId: id,
      label: post.title,
      changes: buildFieldChanges(before, data, Object.keys(data)),
    });

    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar el artículo' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const post = await BlogPost.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  if (!post) {
    return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
  }

  await logAudit({
    actor: user,
    action: 'delete',
    resource: 'blog',
    resourceId: id,
    label: post.title,
  });

  return NextResponse.json({ success: true, message: 'Artículo movido a la papelera' });
}
