import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import Comment from '@/models/Comment';

// ── GET: Fetch and filter comments ──
export async function GET(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // verified | unverified | all
    const rating = searchParams.get('rating') || 'all';
    const sort = searchParams.get('sort') || 'newest';

    const matchQuery: any = {};

    if (search.trim()) {
      matchQuery.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { text: { $regex: search.trim(), $options: 'i' } },
        { slug: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status === 'verified') {
      matchQuery.isVerified = true;
    } else if (status === 'unverified') {
      matchQuery.isVerified = false;
    }

    if (rating !== 'all') {
      const ratingNum = parseInt(rating, 10);
      if (!isNaN(ratingNum)) matchQuery.rating = ratingNum;
    }

    let sortQuery: any = { createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'rating') sortQuery = { rating: -1, createdAt: -1 };
    else if (sort === 'name') sortQuery = { name: 1 };

    const comments = await Comment.find(matchQuery).sort(sortQuery).lean();

    return NextResponse.json({
      success: true,
      comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Error fetching admin comments:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ── PATCH / PUT: Update comment details or verification status ──
export async function PATCH(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const { id, isVerified, name, email, text, rating } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el id del comentario' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof isVerified === 'boolean') updateData.isVerified = isVerified;
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (text !== undefined) updateData.text = text;
    if (typeof rating === 'number') updateData.rating = rating;

    const updatedComment = await Comment.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedComment) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, comment: updatedComment });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Error al actualizar comentario' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}

// ── DELETE: Delete single or bulk comments ──
export async function DELETE(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    let idsToDelete: string[] = [];
    if (queryId) {
      idsToDelete = [queryId];
    } else {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.ids)) {
        idsToDelete = body.ids;
      } else if (body.id) {
        idsToDelete = [body.id];
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No se especificaron comentarios para eliminar' }, { status: 400 });
    }

    await Comment.deleteMany({ _id: { $in: idsToDelete } });

    return NextResponse.json({ success: true, deletedCount: idsToDelete.length });
  } catch (error) {
    console.error('Error deleting comments:', error);
    return NextResponse.json({ error: 'Error al eliminar comentarios' }, { status: 500 });
  }
}
