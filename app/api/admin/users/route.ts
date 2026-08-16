import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

// ── GET: List and filter users ──
export async function GET(request: Request) {
  try {
    const { authorized, user: currentUser } = await isAuthorizedAdmin(request);
    if (!authorized || !currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (currentUser.role === 'editor') {
      return NextResponse.json({ error: 'Los editores no tienen permisos para ver ni gestionar usuarios' }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || 'all';
    const newsletter = searchParams.get('newsletter') || 'all';
    const sort = searchParams.get('sort') || 'newest';

    const matchQuery: any = {};

    if (search.trim()) {
      matchQuery.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (role !== 'all') {
      matchQuery.role = role;
    }

    if (newsletter === 'subscribed') {
      matchQuery.newsletter = true;
    } else if (newsletter === 'unsubscribed') {
      matchQuery.newsletter = false;
    }

    let sortQuery: any = { createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'name') sortQuery = { name: 1 };
    else if (sort === 'listening') sortQuery = { listeningTime: -1 };

    const users = await User.find(matchQuery).sort(sortQuery).lean();

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Error fetching users in admin:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ── PUT: Update user details / role / newsletter ──
export async function PUT(request: Request) {
  try {
    const { authorized, user: currentUser } = await isAuthorizedAdmin(request);
    if (!authorized || !currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (currentUser.role === 'editor') {
      return NextResponse.json({ error: 'Los editores no tienen permisos para modificar usuarios' }, { status: 403 });
    }

    await dbConnect();
    const body = await request.json();
    const { userId, name, email, role, bio, newsletter, listeningTime, currentStreak, maxStreak, favorites } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
    }

    const userBefore = await User.findById(userId);
    if (!userBefore) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Permission check: Admins cannot modify other admins or owners unless they are owner
    if (currentUser.role === 'admin' && (userBefore.role === 'admin' || userBefore.role === 'owner')) {
      if (currentUser.userId !== userBefore._id.toString()) {
        return NextResponse.json({ error: 'Los administradores no pueden modificar a otros admins o propietarios' }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role && (role === 'user' || role === 'editor' || role === 'admin' || role === 'owner')) {
      // Only owner can assign owner role
      if (role === 'owner' && currentUser.role !== 'owner') {
        return NextResponse.json({ error: 'Solo el propietario puede asignar el rol de propietario' }, { status: 403 });
      }
      updateData.role = role;
    }
    if (bio !== undefined) updateData.bio = bio;
    if (newsletter !== undefined) updateData.newsletter = newsletter;
    if (listeningTime !== undefined) updateData.listeningTime = listeningTime;
    if (currentStreak !== undefined) updateData.currentStreak = currentStreak;
    if (maxStreak !== undefined) updateData.maxStreak = maxStreak;
    if (Array.isArray(favorites)) updateData.favorites = favorites;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-__v');

    if (updateData.role && updateData.role !== userBefore.role) {
      await logAudit({
        actor: currentUser,
        action: 'role_change',
        resource: 'user',
        resourceId: userId,
        label: updatedUser?.name || userBefore.name,
        changes: { role: { before: userBefore.role, after: updateData.role } },
      });
    }

    const otherChanges = buildFieldChanges(
      userBefore,
      updateData,
      Object.keys(updateData).filter((key) => key !== 'role')
    );
    if (Object.keys(otherChanges).length > 0) {
      await logAudit({
        actor: currentUser,
        action: 'update',
        resource: 'user',
        resourceId: userId,
        label: updatedUser?.name || userBefore.name,
        changes: otherChanges,
      });
    }

    // Trigger n8n webhook on newsletter subscription status change
    if (newsletter !== undefined && userBefore.newsletter !== newsletter) {
      try {
        fetch('https://n8n.broslunas.com/webhook/veredillasfm-unsub-resub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updatedUser?.name,
            email: updatedUser?.email,
            action: newsletter ? 'subscribe' : 'unsubscribe',
          }),
        }).catch((err) => console.error('Webhook error:', err));
      } catch (err) {
        console.error('Failed to dispatch n8n webhook:', err);
      }
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user in admin:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// ── DELETE: Delete single or multiple users ──
export async function DELETE(request: Request) {
  try {
    const { authorized, user: currentUser } = await isAuthorizedAdmin(request);
    if (!authorized || !currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (currentUser.role === 'editor') {
      return NextResponse.json({ error: 'Los editores no tienen permisos para eliminar usuarios' }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    let userIds: string[] = [];
    if (queryId) {
      userIds = [queryId];
    } else {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.userIds)) {
        userIds = body.userIds;
      } else if (body.userId) {
        userIds = [body.userId];
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json({ error: 'No se especificaron usuarios a eliminar' }, { status: 400 });
    }

    const deletedIds: string[] = [];
    const errors: string[] = [];

    for (const targetId of userIds) {
      if (targetId === currentUser.userId) {
        errors.push('No puedes eliminar tu propia cuenta');
        continue;
      }

      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        errors.push(`Usuario ${targetId} no encontrado`);
        continue;
      }

      if (currentUser.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'owner')) {
        errors.push(`No puedes eliminar al usuario ${targetUser.name} (${targetUser.role})`);
        continue;
      }

      await User.findByIdAndDelete(targetId);
      deletedIds.push(targetId);

      await logAudit({
        actor: currentUser,
        action: 'permanent_delete',
        resource: 'user',
        resourceId: targetId,
        label: targetUser.name,
        metadata: { email: targetUser.email, role: targetUser.role },
      });
    }

    return NextResponse.json({
      success: true,
      deletedIds,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error deleting user in admin:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
