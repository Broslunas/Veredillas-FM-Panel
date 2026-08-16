import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/Team';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const schoolYear = searchParams.get('schoolYear') || '';

  await dbConnect();
  const filter: any = { deletedAt: null };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { role: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }
  if (schoolYear) {
    filter.schoolYear = schoolYear;
  }

  const team = await Team.find(filter).sort({ schoolYear: -1, order: 1, name: 1 });
  return NextResponse.json(team);
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const member = await Team.create(data);

    await logAudit({
      actor: user,
      action: 'create',
      resource: 'team',
      resourceId: member._id.toString(),
      label: member.name,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al crear el miembro del equipo' }, { status: 400 });
  }
}
