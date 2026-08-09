import { randomBytes } from 'crypto';
import { extname } from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import dbConnect from '@/lib/mongodb';
import R2BucketQuota from '@/models/R2BucketQuota';

// ── Audio / General Bucket ──
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '1bdeaebce2649429d4562a6272fd127c';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '33479da4b52490f9a9bbff3e4a2c92cb';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '3b7b01723ef853c1b31b4324021144846a29d8b4b71246eac96dda446877a860';
export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vfm-bucket-01';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Images Public CDN Bucket (cdn.veredillasfm.es) ──
const IMAGE_R2_ACCOUNT_ID = process.env.IMAGE_R2_ACCOUNT_ID || 'eb7cdbc609e3329015726445b7f28415';
const IMAGE_R2_ACCESS_KEY_ID = process.env.IMAGE_R2_ACCESS_KEY_ID || '1ab50cd2f17f894744fef5a26c1005f7';
const IMAGE_R2_SECRET_ACCESS_KEY = process.env.IMAGE_R2_SECRET_ACCESS_KEY || '091414247b8327ca8234316560c609a917592f15c087e9fd927313c590b5c273';
export const IMAGE_BUCKET_NAME = process.env.IMAGE_R2_BUCKET_NAME || 'radioveredillas';
const IMAGE_R2_ENDPOINT = process.env.IMAGE_R2_ENDPOINT || `https://${IMAGE_R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`;
export const IMAGE_CDN_BASE = process.env.IMAGE_CDN_URL || 'https://cdn.veredillasfm.es';

export const imageR2Client = new S3Client({
  region: 'auto',
  endpoint: IMAGE_R2_ENDPOINT,
  credentials: {
    accessKeyId: IMAGE_R2_ACCESS_KEY_ID,
    secretAccessKey: IMAGE_R2_SECRET_ACCESS_KEY,
  },
});

export function isImageContentType(contentType: string, fileName: string): boolean {
  if (contentType.startsWith('image/')) return true;
  return /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(fileName);
}

export type R2UploadTarget = 'auto' | 'image' | 'audio' | 'video';

export const KNOWN_R2_BUCKETS = [BUCKET_NAME, IMAGE_BUCKET_NAME] as const;

function getMediaTypeFromKey(key: string) {
  const lowerKey = key.toLowerCase();
  return {
    isImage: !!lowerKey.match(/\.(png|jpe?g|webp|gif|svg|avif)$/i),
    isAudio: !!lowerKey.match(/\.(mp3|wav|m4a|ogg|flac)$/i),
    isVideo: !!lowerKey.match(/\.(mp4|webm|mov|mkv|avi)$/i),
  };
}

export function getR2PublicUrl(key: string, isImage: boolean = false): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const cleanKey = key.replace(/^\//, '');
  if (isImage) {
    return `${IMAGE_CDN_BASE}/${cleanKey}`;
  }
  return `${R2_PUBLIC_BASE}/${cleanKey}`;
}

export async function getBucketUsage(bucket: string) {
  const client = bucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;
  let continuationToken: string | undefined;
  let totalBytes = 0;
  let totalObjects = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: '',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(listCommand);
    const contents = response.Contents || [];
    for (const item of contents) {
      if (item.Key) {
        totalObjects += 1;
        totalBytes += item.Size || 0;
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return { totalBytes, totalObjects };
}

export async function getBucketQuota(bucket: string): Promise<number | null> {
  await dbConnect();
  const quota = await R2BucketQuota.findOne({ bucket }).lean();
  return quota?.maxBytes ?? null;
}

export async function uploadFileToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'uploads',
  target: R2UploadTarget = 'auto'
): Promise<{ key: string; url: string; bucket: string }> {
  await dbConnect();
  const extension = extname(fileName).toLowerCase();
  const baseName = fileName.replace(new RegExp(`${extension}$`, 'i'), '') || 'file';
  const slugName = baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
  const randomSuffix = randomBytes(4).toString('hex');
  const safeName = `${slugName || 'file'}-${randomSuffix}${extension}`;

  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads';
  const isImage = isImageContentType(contentType, fileName);
  const isAudio = contentType.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(fileName);
  const isVideo = contentType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(fileName);

  let resolvedBucket = BUCKET_NAME;
  let resolvedFolder = normalizedFolder;

  if (target === 'video' || isVideo) {
    resolvedBucket = BUCKET_NAME;
    resolvedFolder = normalizedFolder || 'videos';
  } else if (target === 'audio' || isAudio) {
    resolvedBucket = IMAGE_BUCKET_NAME;
    resolvedFolder = normalizedFolder || 'audios';
  } else if (target === 'image' || isImage) {
    resolvedBucket = IMAGE_BUCKET_NAME;
    resolvedFolder = normalizedFolder || 'images';
  } else {
    resolvedBucket = BUCKET_NAME;
    resolvedFolder = normalizedFolder || 'uploads';
  }

  const currentUsage = await getBucketUsage(resolvedBucket);
  const maxBytes = await getBucketQuota(resolvedBucket);
  if (maxBytes !== null && currentUsage.totalBytes + fileBuffer.length > maxBytes) {
    throw new Error('Límite de bucket alcanzado. No se puede subir este archivo.');
  }

  const key = `${resolvedFolder}/${safeName}`;
  const client = resolvedBucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;
  const publicBase = resolvedBucket === IMAGE_BUCKET_NAME ? IMAGE_CDN_BASE : R2_PUBLIC_BASE;

  const command = new PutObjectCommand({
    Bucket: resolvedBucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  const url = `${publicBase}/${key}`;

  return { key, url, bucket: resolvedBucket };
}

export async function deleteR2File(key: string, bucket?: string): Promise<boolean> {
  try {
    const isUrl = key.startsWith('http://') || key.startsWith('https://');
    const cleanKey = isUrl ? key.replace(/^https?:\/\/[^\/]+\//, '') : key.replace(/^\/+/, '');

    const useBucket = bucket || (key.includes('cdn.veredillasfm.es') ? IMAGE_BUCKET_NAME : BUCKET_NAME);
    const client = useBucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;

    const command = new DeleteObjectCommand({
      Bucket: useBucket,
      Key: cleanKey,
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return false;
  }
}

export async function deleteR2Prefix(bucket: string, prefix: string): Promise<boolean> {
  try {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const client = bucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;

    const objectsToDelete: { Key: string }[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
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
        Bucket: bucket,
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

export async function renameR2File(bucket: string, sourceKey: string, destinationKey: string): Promise<boolean> {
  const cleanSourceKey = sourceKey.replace(/^\/+/, '');
  const cleanDestinationKey = destinationKey.replace(/^\/+/, '');
  const client = bucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;
  const encodedSourceKey = encodeURIComponent(cleanSourceKey).replace(/%2F/g, '/');

  try {
    const copyCommand = new CopyObjectCommand({
      Bucket: bucket,
      Key: cleanDestinationKey,
      CopySource: `${bucket}/${encodedSourceKey}`,
      MetadataDirective: 'COPY',
    });
    await client.send(copyCommand);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: cleanSourceKey,
    });
    await client.send(deleteCommand);

    return true;
  } catch (error) {
    console.error('Error renaming file in R2:', error);
    return false;
  }
}

export async function listR2Files(prefix: string = '') {
  try {
    const [imageRes, audioRes] = await Promise.allSettled([
      imageR2Client.send(new ListObjectsV2Command({ Bucket: IMAGE_BUCKET_NAME, Prefix: prefix, MaxKeys: 100 })),
      r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, MaxKeys: 100 })),
    ]);

    const imageFiles = imageRes.status === 'fulfilled' ? (imageRes.value.Contents || []).map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified,
      url: `${IMAGE_CDN_BASE}/${item.Key}`,
      bucket: IMAGE_BUCKET_NAME,
      isImage: true,
    })) : [];

    const audioFiles = audioRes.status === 'fulfilled' ? (audioRes.value.Contents || []).map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified,
      url: getR2PublicUrl(item.Key || '', false),
      bucket: BUCKET_NAME,
      isImage: false,
    })) : [];

    return [...imageFiles, ...audioFiles].sort(
      (a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()
    );
  } catch (error) {
    console.error('Error listing R2 files:', error);
    return [];
  }
}
