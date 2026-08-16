import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GalleryCategory from '@/models/GalleryCategory';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const category = await GalleryCategory.findById(id);
  if (!category) {
    return NextResponse.json({ error: 'Categoría de galería no encontrada' }, { status: 404 });
  }

  return NextResponse.json(category);
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

    const before = await GalleryCategory.findById(id).lean();
    const category = await GalleryCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!category) {
      return NextResponse.json({ error: 'Categoría de galería no encontrada' }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'gallery',
      resourceId: id,
      label: category.category,
      changes: buildFieldChanges(before, data, Object.keys(data)),
    });

    return NextResponse.json(category);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al actualizar la categoría de galería' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const category = await GalleryCategory.findByIdAndDelete(id);
  if (!category) {
    return NextResponse.json({ error: 'Categoría de galería no encontrada' }, { status: 404 });
  }

  await logAudit({
    actor: user,
    action: 'permanent_delete',
    resource: 'gallery',
    resourceId: id,
    label: category.category,
  });

  return NextResponse.json({ success: true, message: 'Categoría de galería eliminada' });
}
