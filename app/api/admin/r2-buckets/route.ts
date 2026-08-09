import { NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import dbConnect from '@/lib/mongodb';
import R2BucketQuota from '@/models/R2BucketQuota';
import { KNOWN_R2_BUCKETS, IMAGE_BUCKET_NAME, BUCKET_NAME, imageR2Client, r2Client } from '@/lib/r2';
import { isAuthorizedAdmin } from '@/lib/api-guard';

async function readBucketUsage(bucket: string) {
  try {
    const client = bucket === IMAGE_BUCKET_NAME ? imageR2Client : r2Client;
    let continuationToken: string | undefined;
    let totalBytes = 0;
    let totalObjects = 0;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: '',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const response = await client.send(command);
      const contents = response.Contents || [];
      for (const item of contents) {
        if (item.Key) {
          totalObjects += 1;
          totalBytes += item.Size || 0;
        }
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return { bucket, totalBytes, totalObjects };
  } catch (err) {
    console.error(`Error reading bucket usage for ${bucket}:`, err);
    return { bucket, totalBytes: 0, totalObjects: 0 };
  }
}

export async function GET(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }
  try {
    await dbConnect();

    const quotas = await R2BucketQuota.find({ bucket: { $in: [...KNOWN_R2_BUCKETS] } }).lean();
    const usage = await Promise.all(
      [...KNOWN_R2_BUCKETS].map(async (bucket) => {
        const { totalBytes, totalObjects } = await readBucketUsage(bucket);
        const quota = quotas.find((item) => item.bucket === bucket);
        return {
          bucket,
          totalBytes,
          totalObjects,
          maxBytes: quota?.maxBytes ?? null,
        };
      })
    );

    const totalBytesAcrossBuckets = usage.reduce((sum, item) => sum + item.totalBytes, 0);

    return NextResponse.json({ usage, totalBytesAcrossBuckets });
  } catch (error: any) {
    console.error('Error in GET /api/admin/r2-buckets:', error);
    return NextResponse.json({ error: error.message || 'Error reading R2 buckets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user || user.role === 'editor') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  try {
    await dbConnect();
    const { bucket, maxBytes } = await request.json();
    if (!bucket || typeof maxBytes !== 'number' || maxBytes < 0) {
      return NextResponse.json({ error: 'Bucket o maxBytes incorrectos' }, { status: 400 });
    }

    if (![...KNOWN_R2_BUCKETS].includes(bucket)) {
      return NextResponse.json({ error: 'Bucket no reconocido' }, { status: 400 });
    }

    const updated = await R2BucketQuota.findOneAndUpdate(
      { bucket },
      { bucket, maxBytes },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ success: true, quota: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al guardar cuota' }, { status: 500 });
  }
}
