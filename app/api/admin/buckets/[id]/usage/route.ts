import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import R2Bucket from '@/models/R2Bucket';
import { getBucketUsage } from '@/lib/r2';
import { checkAndSendStorageAlert } from '@/lib/storage-alerts';

/**
 * Retrieves storage usage for a bucket.
 *
 * @param request - The incoming request used to verify authorization
 * @param params - Route parameters containing the bucket ID
 * @returns A response containing the bucket's usage totals, configured limit, and extension breakdown
 */
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
    const { totalBytes, totalObjects, byExtension } = await getBucketUsage(bucket.bucketName);
    await checkAndSendStorageAlert(bucket, totalBytes);
    return NextResponse.json({ totalBytes, totalObjects, maxBytes: bucket.maxBytes, byExtension });
  } catch (error: any) {
    console.error('Error reading bucket usage:', error);
    return NextResponse.json({ error: error.message || 'Error al leer el uso del bucket' }, { status: 500 });
  }
}
