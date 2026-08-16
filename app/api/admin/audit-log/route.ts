import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

const PAGE_SIZE = 30;

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  await dbConnect();

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource') || 'all';
  const action = searchParams.get('action') || 'all';
  const q = searchParams.get('q') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const filter: any = {};
  if (resource !== 'all') filter.resource = resource;
  if (action !== 'all') filter.action = action;
  if (q.trim()) {
    filter.$or = [
      { label: { $regex: q.trim(), $options: 'i' } },
      { actorName: { $regex: q.trim(), $options: 'i' } },
      { actorEmail: { $regex: q.trim(), $options: 'i' } },
    ];
  }

  const [logs, total, resources] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct('resource'),
  ]);

  return NextResponse.json({
    success: true,
    logs,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    resources: resources.sort(),
  });
}
