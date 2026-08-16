import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GalleryCategory from '@/models/GalleryCategory';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  await dbConnect();
  const filter: any = {};
  if (q) {
    filter.$or = [
      { category: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }

  const categories = await GalleryCategory.find(filter).sort({ category: 1 });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    if (!data.slug && data.category) {
      data.slug = data.category
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const created = await GalleryCategory.create(data);

    await logAudit({
      actor: user,
      action: 'create',
      resource: 'gallery',
      resourceId: created._id.toString(),
      label: created.category,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al crear la categoría de galería' }, { status: 400 });
  }
}
