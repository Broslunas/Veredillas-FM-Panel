import { randomBytes } from 'crypto';
import { extname } from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import dbConnect from '@/lib/mongodb';
import R2Bucket, { IR2Bucket, R2BucketType } from '@/models/R2Bucket';
import { decryptSecret } from '@/lib/encryption';

export type R2UploadTarget = 'auto' | 'image' | 'audio' | 'video';

const s3ClientCache = new Map<string, S3Client>();

export function isImageContentType(contentType: string, fileName: string): boolean {
  if (contentType.startsWith('image/')) return true;
  return /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(fileName);
}

function getMediaTypeFromFile(contentType: string, fileName: string) {
  return {
    isImage: isImageContentType(contentType, fileName),
    isAudio: contentType.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(fileName),
    isVideo: contentType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(fileName),
  };
}

async function resolveBucketByName(bucketName: string): Promise<IR2Bucket> {
  await dbConnect();
  const bucket = await R2Bucket.findOne({ bucketName }).lean<IR2Bucket>();
  if (!bucket) {
    throw new Error(`No se encontró el bucket "${bucketName}" en la base de datos`);
  }
  return bucket;
}

export async function getBucketByType(type: R2BucketType): Promise<IR2Bucket | null> {
  await dbConnect();
  return R2Bucket.findOne({ type, isDefault: true, isActive: true }).lean<IR2Bucket>();
}

export function getS3ClientForBucket(bucket: IR2Bucket): S3Client {
  const cacheKey = `${bucket._id}:${new Date(bucket.updatedAt).getTime()}`;
  const cached = s3ClientCache.get(cacheKey);
  if (cached) return cached;

  const client = new S3Client({
    region: 'auto',
    endpoint: bucket.endpoint,
    credentials: {
      accessKeyId: bucket.accessKeyId,
      secretAccessKey: decryptSecret(bucket.secretAccessKeyEncrypted),
    },
  });

  s3ClientCache.set(cacheKey, client);
  return client;
}

export function buildPublicUrl(bucket: IR2Bucket, key: string): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const cleanKey = key.replace(/^\//, '');
  return `${bucket.publicUrlBase.replace(/\/+$/, '')}/${cleanKey}`;
}

export function serializeBucketForClient(bucket: IR2Bucket) {
  return {
    id: bucket._id.toString(),
    label: bucket.label,
    bucketName: bucket.bucketName,
    type: bucket.type,
    isDefault: bucket.isDefault,
    isActive: bucket.isActive,
    accountId: bucket.accountId,
    accessKeyId: bucket.accessKeyId,
    hasSecret: Boolean(bucket.secretAccessKeyEncrypted),
    endpoint: bucket.endpoint,
    publicUrlBase: bucket.publicUrlBase,
    maxBytes: bucket.maxBytes,
    createdAt: bucket.createdAt,
    updatedAt: bucket.updatedAt,
  };
}

function getExtensionKey(key: string): string {
  if (!key || key.endsWith('/')) return 'sin-extension';
  const ext = extname(key).toLowerCase();
  if (!ext || ext === '.') return 'sin-extension';
  return ext.slice(1);
}

export async function getBucketUsage(bucketName: string) {
  const bucket = await resolveBucketByName(bucketName);
  const client = getS3ClientForBucket(bucket);
  let continuationToken: string | undefined;
  let totalBytes = 0;
  let totalObjects = 0;
  const extensionMap = new Map<string, { bytes: number; objects: number }>();

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket.bucketName,
      Prefix: '',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(listCommand);
    const contents = response.Contents || [];
    for (const item of contents) {
      if (item.Key) {
        totalObjects += 1;
        const size = item.Size || 0;
        totalBytes += size;

        const extKey = getExtensionKey(item.Key);
        const entry = extensionMap.get(extKey) || { bytes: 0, objects: 0 };
        entry.bytes += size;
        entry.objects += 1;
        extensionMap.set(extKey, entry);
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  const byExtension = Array.from(extensionMap.entries())
    .map(([extension, stats]) => ({ extension, bytes: stats.bytes, objects: stats.objects }))
    .sort((a, b) => b.bytes - a.bytes);

  return { totalBytes, totalObjects, byExtension };
}

async function objectExists(client: S3Client, bucketName: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function resolveVersionedKey(
  client: S3Client,
  bucketName: string,
  folder: string,
  baseName: string,
  extension: string
): Promise<string> {
  const candidate = `${folder}/${baseName}${extension}`;
  if (!(await objectExists(client, bucketName, candidate))) {
    return candidate;
  }

  for (let version = 2; version < 1000; version += 1) {
    const versionedCandidate = `${folder}/${baseName}-v${version}${extension}`;
    if (!(await objectExists(client, bucketName, versionedCandidate))) {
      return versionedCandidate;
    }
  }

  throw new Error('No se pudo generar un nombre de archivo disponible tras 999 versiones');
}

function slugifyEntityId(entityId: string): string {
  return entityId
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function resolveUploadDestination(
  fileName: string,
  contentType: string,
  folder: string = 'uploads',
  target: R2UploadTarget = 'auto',
  entityId?: string
): Promise<{ bucket: IR2Bucket; key: string }> {
  const { isImage, isAudio, isVideo } = getMediaTypeFromFile(contentType, fileName);

  let resolvedType: R2BucketType = 'multimedia';
  let resolvedFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads';

  if (target === 'image' || (target === 'auto' && isImage)) {
    resolvedType = 'images';
    resolvedFolder = resolvedFolder || 'images';
  } else if (target === 'video' || (target === 'auto' && isVideo)) {
    resolvedType = 'multimedia';
    resolvedFolder = resolvedFolder || 'videos';
  } else if (target === 'audio' || (target === 'auto' && isAudio)) {
    resolvedType = 'multimedia';
    resolvedFolder = resolvedFolder || 'audios';
  }

  const bucket = await getBucketByType(resolvedType);
  if (!bucket) {
    throw new Error(`No hay ningún bucket predeterminado configurado para el tipo "${resolvedType}"`);
  }

  const extension = extname(fileName).toLowerCase();
  const client = getS3ClientForBucket(bucket);

  let key: string;
  const safeEntityId = entityId ? slugifyEntityId(entityId) : '';

  if (safeEntityId) {
    key = await resolveVersionedKey(client, bucket.bucketName, resolvedFolder, safeEntityId, extension);
  } else {
    const baseName = fileName.replace(new RegExp(`${extension}$`, 'i'), '') || 'file';
    const slugName = baseName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);
    const randomSuffix = randomBytes(4).toString('hex');
    const safeName = `${slugName || 'file'}-${randomSuffix}${extension}`;
    key = `${resolvedFolder}/${safeName}`;
  }

  return { bucket, key };
}

export async function resolveR2ObjectFromUrl(url: string): Promise<{ bucket: IR2Bucket; key: string }> {
  await dbConnect();
  const buckets = await R2Bucket.find({ isActive: true }).lean<IR2Bucket[]>();
  const bucket = buckets.find((b) => url.startsWith(`${b.publicUrlBase.replace(/\/+$/, '')}/`));
  if (!bucket) {
    throw new Error('No se encontró ningún bucket que corresponda a esta URL');
  }

  const key = url.slice(bucket.publicUrlBase.replace(/\/+$/, '').length).replace(/^\/+/, '');
  return { bucket, key };
}

export async function uploadFileToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'uploads',
  target: R2UploadTarget = 'auto',
  entityId?: string
): Promise<{ key: string; url: string; bucket: string }> {
  const { bucket, key } = await resolveUploadDestination(fileName, contentType, folder, target, entityId);
  const client = getS3ClientForBucket(bucket);

  const currentUsage = await getBucketUsage(bucket.bucketName);
  if (currentUsage.totalBytes + fileBuffer.length > bucket.maxBytes) {
    throw new Error('Límite de bucket alcanzado. No se puede subir este archivo.');
  }

  const command = new PutObjectCommand({
    Bucket: bucket.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  return { key, url: buildPublicUrl(bucket, key), bucket: bucket.bucketName };
}

export async function deleteR2File(key: string, bucketName?: string): Promise<boolean> {
  if (!bucketName) {
    console.error('deleteR2File: se requiere el nombre del bucket');
    return false;
  }

  try {
    const isUrl = key.startsWith('http://') || key.startsWith('https://');
    const cleanKey = isUrl ? key.replace(/^https?:\/\/[^\/]+\//, '') : key.replace(/^\/+/, '');

    const bucket = await resolveBucketByName(bucketName);
    const client = getS3ClientForBucket(bucket);

    const command = new DeleteObjectCommand({
      Bucket: bucket.bucketName,
      Key: cleanKey,
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return false;
  }
}

export async function deleteR2Prefix(bucketName: string, prefix: string): Promise<boolean> {
  try {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const bucket = await resolveBucketByName(bucketName);
    const client = getS3ClientForBucket(bucket);

    const objectsToDelete: { Key: string }[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket.bucketName,
        Prefix: cleanPrefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await client.send(listCommand);
      const contents = response.Contents || [];
      contents.forEach((item) => {
        if (item.Key) {
          objectsToDelete.push({ Key: item.Key });
        }
      });
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    if (objectsToDelete.length === 0) {
      return true;
    }

    for (let i = 0; i < objectsToDelete.length; i += 1000) {
      const chunk = objectsToDelete.slice(i, i + 1000);
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket.bucketName,
        Delete: {
          Objects: chunk,
          Quiet: true,
        },
      });
      await client.send(deleteCommand);
    }

    return true;
  } catch (error) {
    console.error('Error deleting prefix from R2:', error);
    return false;
  }
}

export async function renameR2File(bucketName: string, sourceKey: string, destinationKey: string): Promise<boolean> {
  const cleanSourceKey = sourceKey.replace(/^\/+/, '');
  const cleanDestinationKey = destinationKey.replace(/^\/+/, '');

  try {
    const bucket = await resolveBucketByName(bucketName);
    const client = getS3ClientForBucket(bucket);
    const encodedSourceKey = encodeURIComponent(cleanSourceKey).replace(/%2F/g, '/');

    const copyCommand = new CopyObjectCommand({
      Bucket: bucket.bucketName,
      Key: cleanDestinationKey,
      CopySource: `${bucket.bucketName}/${encodedSourceKey}`,
      MetadataDirective: 'COPY',
    });
    await client.send(copyCommand);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket.bucketName,
      Key: cleanSourceKey,
    });
    await client.send(deleteCommand);

    return true;
  } catch (error) {
    console.error('Error renaming file in R2:', error);
    return false;
  }
}

export async function listR2Files(prefix: string = '', bucketName?: string) {
  try {
    await dbConnect();
    const query: Record<string, unknown> = { isActive: true };
    if (bucketName) query.bucketName = bucketName;
    const buckets = await R2Bucket.find(query).lean<IR2Bucket[]>();

    const results = await Promise.allSettled(
      buckets.map(async (bucket) => {
        const client = getS3ClientForBucket(bucket);
        const response = await client.send(
          new ListObjectsV2Command({ Bucket: bucket.bucketName, Prefix: prefix, MaxKeys: 100 })
        );
        return (response.Contents || []).map((item) => ({
          key: item.Key || '',
          size: item.Size || 0,
          lastModified: item.LastModified,
          url: buildPublicUrl(bucket, item.Key || ''),
          bucket: bucket.bucketName,
          isImage: bucket.type === 'images',
        }));
      })
    );

    const files = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    return files.sort(
      (a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()
    );
  } catch (error) {
    console.error('Error listing R2 files:', error);
    return [];
  }
}

export async function listR2FolderContents(bucketName: string, prefix: string = '', continuationToken?: string) {
  const bucket = await resolveBucketByName(bucketName);
  const client = getS3ClientForBucket(bucket);

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket.bucketName,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 200,
      ContinuationToken: continuationToken,
    })
  );

  const folders = (response.CommonPrefixes || [])
    .map((item) => item.Prefix || '')
    .filter(Boolean);

  const files = (response.Contents || [])
    .filter((item) => item.Key && item.Key !== prefix)
    .map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified,
      url: buildPublicUrl(bucket, item.Key || ''),
    }));

  return {
    bucket: bucket.bucketName,
    isImage: bucket.type === 'images',
    folders,
    files,
    isTruncated: Boolean(response.IsTruncated),
    nextContinuationToken: response.NextContinuationToken,
  };
}
