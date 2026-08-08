import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'veredillasfm';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://cdn.veredillasfm.es';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

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

    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `social-clips/${timestamp}_${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // Presigned URL valid for 30 minutes
    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 1800 });
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ presignedUrl, publicUrl, key });
  } catch (error) {
    console.error('Error generating R2 presigned URL:', error);
    return NextResponse.json({ error: 'Error interno al generar la URL de carga' }, { status: 500 });
  }
}
