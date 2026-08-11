import mongoose, { Schema } from 'mongoose';

export const HARD_MAX_BUCKET_BYTES = Math.floor(9.2 * 1024 ** 3); // 9.2GB, techo estricto del sistema

export type R2BucketType = 'images' | 'multimedia';

export interface IR2Bucket {
  _id: mongoose.Types.ObjectId;
  label: string;
  bucketName: string;
  type: R2BucketType;
  isDefault: boolean;
  isActive: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKeyEncrypted: string;
  endpoint: string;
  publicUrlBase: string;
  maxBytes: number;
  lastAlertThreshold: number;
  lastAlertAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const R2BucketSchema = new Schema<IR2Bucket>(
  {
    label: { type: String, required: true, trim: true },
    bucketName: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: ['images', 'multimedia'], required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    accountId: { type: String, required: true },
    accessKeyId: { type: String, required: true },
    secretAccessKeyEncrypted: { type: String, required: true },
    endpoint: { type: String, required: true },
    publicUrlBase: { type: String, required: true },
    maxBytes: { type: Number, required: true, max: HARD_MAX_BUCKET_BYTES },
    lastAlertThreshold: { type: Number, default: 0 },
    lastAlertAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const R2Bucket = mongoose.models.R2Bucket || mongoose.model<IR2Bucket>('R2Bucket', R2BucketSchema);

export default R2Bucket;
