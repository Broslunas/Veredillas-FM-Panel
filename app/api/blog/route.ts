import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BlogPost from '@/models/BlogPost';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  await dbConnect();
  const filter: any = { deletedAt: null };
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }

  const posts = await BlogPost.find(filter).sort({ pubDate: -1, createdAt: -1 });
  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedRoute(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    if (!data.slug && data.title) {
      data.slug = data.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const post = await BlogPost.create(data);

    await logAudit({
      actor: user,
      action: 'create',
      resource: 'blog',
      resourceId: post._id.toString(),
      label: post.title,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al crear la publicación' }, { status: 400 });
  }
}
