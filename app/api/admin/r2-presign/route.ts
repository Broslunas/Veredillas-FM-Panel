import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveUploadDestination, getS3ClientForBucket, buildPublicUrl, getBucketUsage, R2UploadTarget } from '@/lib/r2';
import { notifyUploadBlocked } from '@/lib/storage-alerts';

/**
 * Generates a presigned URL and public URL for uploading a file to storage.
 *
 * @param request - The incoming request containing the file name, content type, and upload destination details.
 * @returns The presigned upload URL, public file URL, and object key.
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { fileName, contentType, folder, target, fileId, fileSize } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Faltan parámetros (fileName, contentType)' }, { status: 400 });
    }

    const { bucket, key } = await resolveUploadDestination(
      fileName,
      contentType,
      folder || 'social-clips',
      (target as R2UploadTarget) || 'auto',
      fileId || undefined
    );

    if (typeof fileSize === 'number') {
      const currentUsage = await getBucketUsage(bucket.bucketName);
      if (currentUsage.totalBytes + fileSize > bucket.maxBytes) {
        await notifyUploadBlocked(bucket, fileSize, currentUsage.totalBytes, fileName);
        return NextResponse.json({ error: 'Límite de bucket alcanzado. No se puede subir este archivo.' }, { status: 400 });
      }
    }

    const command = new PutObjectCommand({
      Bucket: bucket.bucketName,
      Key: key,
      ContentType: contentType,
    });

    // Presigned URL valid for 30 minutes
    const client = getS3ClientForBucket(bucket);
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 1800 });
    const publicUrl = buildPublicUrl(bucket, key);

    return NextResponse.json({ presignedUrl, publicUrl, key });
  } catch (error) {
    console.error('Error generating R2 presigned URL:', error);
    return NextResponse.json({ error: 'Error interno al generar la URL de carga' }, { status: 500 });
  }
}
