import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveR2ObjectFromUrl, getS3ClientForBucket } from '@/lib/r2';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
  }

  try {
    const { bucket, key } = await resolveR2ObjectFromUrl(url);
    const client = getS3ClientForBucket(bucket);
    const command = new GetObjectCommand({ Bucket: bucket.bucketName, Key: key });

    // Presigned GET valid for 15 minutes; the browser downloads directly from
    // R2 with this, so the file never passes through the Vercel function.
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return NextResponse.json({ presignedUrl });
  } catch (error: any) {
    console.error('Error generating R2 presigned download URL:', error);
    return NextResponse.json({ error: error.message || 'Error al generar la URL de descarga' }, { status: 500 });
  }
}
