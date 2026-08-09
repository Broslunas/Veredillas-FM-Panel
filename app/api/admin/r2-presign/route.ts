import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getBucketByType, getS3ClientForBucket, buildPublicUrl } from '@/lib/r2';

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Faltan parámetros (fileName, contentType)' }, { status: 400 });
    }

    const bucket = await getBucketByType('multimedia');
    if (!bucket) {
      return NextResponse.json({ error: 'No hay ningún bucket predeterminado configurado para multimedia' }, { status: 500 });
    }

    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `social-clips/${timestamp}_${sanitizedName}`;

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
