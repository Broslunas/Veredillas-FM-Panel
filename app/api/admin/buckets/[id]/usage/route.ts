import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import R2Bucket from '@/models/R2Bucket';
import { getBucketUsage } from '@/lib/r2';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const bucket = await R2Bucket.findById(id).lean();
  if (!bucket) {
    return NextResponse.json({ error: 'Bucket no encontrado' }, { status: 404 });
  }

  try {
    const { totalBytes, totalObjects } = await getBucketUsage(bucket.bucketName);
    return NextResponse.json({ totalBytes, totalObjects, maxBytes: bucket.maxBytes });
  } catch (error: any) {
    console.error('Error reading bucket usage:', error);
    return NextResponse.json({ error: error.message || 'Error al leer el uso del bucket' }, { status: 500 });
  }
}
