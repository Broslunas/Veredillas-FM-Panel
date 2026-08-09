import mongoose, { Schema } from 'mongoose';

export interface IR2BucketQuota {
  bucket: string;
  maxBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const R2BucketQuotaSchema = new Schema<IR2BucketQuota>(
  {
    bucket: { type: String, required: true, unique: true },
    maxBytes: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

const R2BucketQuota = mongoose.models.R2BucketQuota || mongoose.model<IR2BucketQuota>('R2BucketQuota', R2BucketQuotaSchema);

export default R2BucketQuota;
