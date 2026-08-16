import { NextResponse } from 'next/server';
import { isAuthorizedOwnerOrAdmin } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import R2Bucket, { HARD_MAX_BUCKET_BYTES, R2BucketType } from '@/models/R2Bucket';
import { encryptSecret } from '@/lib/encryption';
import { serializeBucketForClient } from '@/lib/r2';
import { buildFieldChanges, logAudit } from '@/lib/audit-log';

const AUDITABLE_FIELDS = [
  'label',
  'bucketName',
  'type',
  'accountId',
  'endpoint',
  'publicUrlBase',
  'maxBytes',
  'isActive',
  'isDefault',
];

const VALID_TYPES: R2BucketType[] = ['images', 'multimedia', 'clips'];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const bucket = await R2Bucket.findById(id);
  if (!bucket) {
    return NextResponse.json({ error: 'Bucket no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ bucket: serializeBucketForClient(bucket) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;

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

    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de bucket inválido' }, { status: 400 });
    }

    if (maxBytes !== undefined && (typeof maxBytes !== 'number' || maxBytes <= 0 || maxBytes > HARD_MAX_BUCKET_BYTES)) {
      return NextResponse.json(
        { error: `El límite no puede superar los 9.2GB (${HARD_MAX_BUCKET_BYTES} bytes)` },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await R2Bucket.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Bucket no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (bucketName !== undefined) updateData.bucketName = bucketName;
    if (type !== undefined) updateData.type = type;
    if (accountId !== undefined) updateData.accountId = accountId;
    if (accessKeyId !== undefined) updateData.accessKeyId = accessKeyId;
    if (endpoint !== undefined) updateData.endpoint = endpoint;
    if (publicUrlBase !== undefined) updateData.publicUrlBase = publicUrlBase;
    if (maxBytes !== undefined) updateData.maxBytes = maxBytes;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (secretAccessKey) {
      updateData.secretAccessKeyEncrypted = encryptSecret(secretAccessKey);
    }

    const resolvedType: R2BucketType = type !== undefined ? type : existing.type;

    if (isDefault === true) {
      await R2Bucket.updateMany({ type: resolvedType, _id: { $ne: id } }, { isDefault: false });
      updateData.isDefault = true;
    } else if (isDefault === false) {
      updateData.isDefault = false;
    }

    const bucket = await R2Bucket.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!bucket) {
      return NextResponse.json({ error: 'Bucket no encontrado' }, { status: 404 });
    }

    const changes = buildFieldChanges(existing, updateData, AUDITABLE_FIELDS.filter((f) => f in updateData));
    if (updateData.secretAccessKeyEncrypted) {
      changes.secretAccessKey = { before: '••••••••', after: '••••••••' };
    }

    await logAudit({
      actor: user,
      action: 'update',
      resource: 'bucket',
      resourceId: id,
      label: bucket.label,
      changes,
    });

    return NextResponse.json({ success: true, bucket: serializeBucketForClient(bucket) });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Ya existe un bucket con ese nombre' }, { status: 409 });
    }
    console.error('Error updating R2 bucket:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar el bucket' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user } = await isAuthorizedOwnerOrAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const bucket = await R2Bucket.findById(id);
  if (!bucket) {
    return NextResponse.json({ error: 'Bucket no encontrado' }, { status: 404 });
  }

  if (bucket.isDefault) {
    return NextResponse.json(
      { error: 'No puedes eliminar un bucket predeterminado. Marca otro bucket del mismo tipo como predeterminado primero.' },
      { status: 400 }
    );
  }

  await R2Bucket.findByIdAndDelete(id);

  await logAudit({
    actor: user,
    action: 'permanent_delete',
    resource: 'bucket',
    resourceId: id,
    label: bucket.label,
    metadata: { bucketName: bucket.bucketName, type: bucket.type },
  });

  return NextResponse.json({ success: true, message: 'Bucket eliminado correctamente' });
}
