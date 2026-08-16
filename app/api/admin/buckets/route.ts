import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import R2Bucket, { HARD_MAX_BUCKET_BYTES, R2BucketType } from '@/models/R2Bucket';
import { encryptSecret } from '@/lib/encryption';
import { serializeBucketForClient } from '@/lib/r2';
import { logAudit } from '@/lib/audit-log';

const VALID_TYPES: R2BucketType[] = ['images', 'multimedia', 'clips'];

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  await dbConnect();
  const buckets = await R2Bucket.find().sort({ type: 1, isDefault: -1, label: 1 });

  return NextResponse.json({ buckets: buckets.map(serializeBucketForClient) });
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      label,
      bucketName,
      type,
      accountId,
      accessKeyId,
      secretAccessKey,
      endpoint,
      publicUrlBase,
      maxBytes,
      isDefault,
      isActive,
    } = body;

    if (!label || !bucketName || !accountId || !accessKeyId || !secretAccessKey || !endpoint || !publicUrlBase) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de bucket inválido' }, { status: 400 });
    }

    const resolvedMaxBytes = typeof maxBytes === 'number' ? maxBytes : HARD_MAX_BUCKET_BYTES;
    if (resolvedMaxBytes <= 0 || resolvedMaxBytes > HARD_MAX_BUCKET_BYTES) {
      return NextResponse.json(
        { error: `El límite no puede superar los 9.2GB (${HARD_MAX_BUCKET_BYTES} bytes)` },
        { status: 400 }
      );
    }

    await dbConnect();

    if (isDefault) {
      await R2Bucket.updateMany({ type }, { isDefault: false });
    }

    const bucket = await R2Bucket.create({
      label,
      bucketName,
      type,
      accountId,
      accessKeyId,
      secretAccessKeyEncrypted: encryptSecret(secretAccessKey),
      endpoint,
      publicUrlBase,
      maxBytes: resolvedMaxBytes,
      isDefault: Boolean(isDefault),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await logAudit({
      actor: user,
      action: 'create',
      resource: 'bucket',
      resourceId: bucket._id.toString(),
      label: bucket.label,
      metadata: { bucketName, type, isDefault: Boolean(isDefault) },
    });

    return NextResponse.json({ success: true, bucket: serializeBucketForClient(bucket) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Ya existe un bucket con ese nombre' }, { status: 409 });
    }
    console.error('Error creating R2 bucket:', error);
    return NextResponse.json({ error: error.message || 'Error al crear el bucket' }, { status: 500 });
  }
}
