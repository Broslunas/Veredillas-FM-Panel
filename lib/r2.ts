import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

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

export function getR2PublicUrl(key: string, isImage: boolean = false): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const cleanKey = key.replace(/^\//, '');
  if (isImage) {
    return `${IMAGE_CDN_BASE}/${cleanKey}`;
  }
  return `${R2_PUBLIC_BASE}/${cleanKey}`;
}

export async function uploadFileToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<{ key: string; url: string; bucket: string }> {
  const timestamp = Date.now();
  const safeName = fileName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]/g, '-');
  const key = `${folder}/${timestamp}-${safeName}`;

  const isImage = isImageContentType(contentType, fileName);
  const client = isImage ? imageR2Client : r2Client;
  const bucket = isImage ? IMAGE_BUCKET_NAME : BUCKET_NAME;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  const url = isImage
    ? `${IMAGE_CDN_BASE}/${key}`
    : getR2PublicUrl(key, false);

  return { key, url, bucket };
}

export async function deleteR2File(key: string): Promise<boolean> {
  try {
    const isCdnUrl = key.includes('cdn.veredillasfm.es');
    const cleanKey = key.replace(/^https?:\/\/[^\/]+\//, '');

    const client = isCdnUrl ? imageR2Client : r2Client;
    const bucket = isCdnUrl ? IMAGE_BUCKET_NAME : BUCKET_NAME;

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from R2:', error);
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
