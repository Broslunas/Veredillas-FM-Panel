import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import InterviewRequest from '@/models/InterviewRequest';
import User from '@/models/User';

// ── GET: Fetch all interview requests & registered users ──
export async function GET(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();

    const requests = await InterviewRequest.find({}).sort({ preferredDate: 1, createdAt: -1 }).lean();
    const registeredUsers = await User.find({}, 'name email picture').sort({ name: 1 }).lean();

    return NextResponse.json({
      success: true,
      requests,
      registeredUsers,
    });
  } catch (error) {
    console.error('Error fetching interview requests:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ── POST: Create new interview request / invitation ──
export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const { name, email, phone, topic, description, preferredDate, status } = body;

    if (!name || !email || !topic) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (nombre, email, tema)' }, { status: 400 });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const newRequest = await InterviewRequest.create({
      name,
      email,
      phone,
      topic,
      description,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      token,
      status: status || 'invited',
    });

    // Optional webhook trigger to n8n for interview invite
    try {
      fetch('https://n8n.broslunas.com/webhook/veredillasfm-interview-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newRequest._id,
          name: newRequest.name,
          email: newRequest.email,
          topic: newRequest.topic,
          token: newRequest.token,
        }),
      }).catch((err) => console.error('Interview webhook error:', err));
    } catch (err) {
      console.error('Failed to trigger interview webhook:', err);
    }

    return NextResponse.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Error creating interview request:', error);
    return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 });
  }
}

// ── PATCH / PUT: Update status or details ──
export async function PATCH(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const { id, status, name, email, phone, topic, description, preferredDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el id de la entrevista' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (topic) updateData.topic = topic;
    if (description !== undefined) updateData.description = description;
    if (preferredDate !== undefined) updateData.preferredDate = preferredDate ? new Date(preferredDate) : null;

    const updated = await InterviewRequest.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return NextResponse.json({ error: 'Solicitud de entrevista no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Error updating interview request:', error);
    return NextResponse.json({ error: 'Error al actualizar la entrevista' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}

// ── DELETE: Delete interview request by ID ──
export async function DELETE(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    let targetId = queryId;
    if (!targetId) {
      const body = await request.json().catch(() => ({}));
      targetId = body.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: 'Falta el id para eliminar' }, { status: 400 });
    }

    await InterviewRequest.findByIdAndDelete(targetId);

    return NextResponse.json({ success: true, deletedId: targetId });
  } catch (error) {
    console.error('Error deleting interview request:', error);
    return NextResponse.json({ error: 'Error al eliminar solicitud' }, { status: 500 });
  }
}
