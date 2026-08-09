// Migra los 2 buckets R2 configurados actualmente por variables de entorno
// a la nueva colección R2Bucket en MongoDB. Es idempotente: no sobrescribe
// buckets que ya existan por bucketName.
//
// Uso (Node 20+, carga .env.local de forma nativa):
//   node --env-file=.env.local scripts/migrate-r2-buckets.mjs

import mongoose from 'mongoose';
import { createCipheriv, randomBytes } from 'crypto';

const HARD_MAX_BUCKET_BYTES = Math.floor(9.2 * 1024 ** 3);

function encryptSecret(plainText, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

const r2BucketSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

async function main() {
  const { MONGODB_URI, ENCRYPTION_KEY } = process.env;

  if (!MONGODB_URI) throw new Error('Falta MONGODB_URI');
  if (!ENCRYPTION_KEY) throw new Error('Falta ENCRYPTION_KEY. Genera una con: openssl rand -base64 32');

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY debe decodificar a 32 bytes en base64');

  const candidates = [
    {
      label: 'Multimedia (audio/vídeo)',
      bucketName: process.env.R2_BUCKET_NAME || 'vfm-bucket-01',
      type: 'multimedia',
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      publicUrlBase: process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`,
    },
    {
      label: 'Imágenes y otros',
      bucketName: process.env.IMAGE_R2_BUCKET_NAME || 'radioveredillas',
      type: 'images',
      accountId: process.env.IMAGE_R2_ACCOUNT_ID,
      accessKeyId: process.env.IMAGE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.IMAGE_R2_SECRET_ACCESS_KEY,
      endpoint: process.env.IMAGE_R2_ENDPOINT || `https://${process.env.IMAGE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      publicUrlBase: process.env.IMAGE_CDN_URL || 'https://cdn.veredillasfm.es',
    },
  ];

  await mongoose.connect(MONGODB_URI);
  const R2Bucket = mongoose.models.R2Bucket || mongoose.model('R2Bucket', r2BucketSchema);

  for (const candidate of candidates) {
    if (!candidate.accountId || !candidate.accessKeyId || !candidate.secretAccessKey) {
      console.warn(`⚠ Saltando "${candidate.bucketName}": faltan variables de entorno de credenciales.`);
      continue;
    }

    const existing = await R2Bucket.findOne({ bucketName: candidate.bucketName });
    if (existing) {
      console.log(`✓ "${candidate.bucketName}" ya existe en la base de datos, no se modifica.`);
      continue;
    }

    await R2Bucket.create({
      label: candidate.label,
      bucketName: candidate.bucketName,
      type: candidate.type,
      accountId: candidate.accountId,
      accessKeyId: candidate.accessKeyId,
      secretAccessKeyEncrypted: encryptSecret(candidate.secretAccessKey, key),
      endpoint: candidate.endpoint,
      publicUrlBase: candidate.publicUrlBase,
      maxBytes: HARD_MAX_BUCKET_BYTES,
      isDefault: true,
      isActive: true,
    });

    console.log(`✓ Creado bucket "${candidate.bucketName}" (tipo: ${candidate.type}, predeterminado).`);
  }

  await mongoose.disconnect();
  console.log('Migración completada.');
}

main().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
