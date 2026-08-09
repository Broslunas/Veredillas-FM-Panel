export interface PresignedUploadOptions {
  folder?: string;
  target?: 'auto' | 'image' | 'audio' | 'video';
  entityId?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads a file straight from the browser to R2 via a presigned URL, bypassing
 * the Next.js server so large files (audio/video) don't hit its request body limits.
 */
export async function uploadFileToR2ViaPresignedUrl(file: File, options: PresignedUploadOptions = {}): Promise<string> {
  const { folder, target, entityId, onProgress } = options;

  const presignRes = await fetch('/api/admin/r2-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
      target,
      fileId: entityId,
      fileSize: file.size,
    }),
  });

  if (!presignRes.ok) {
    const data = await presignRes.json().catch(() => null);
    throw new Error(data?.error || 'Error al solicitar la URL de subida a R2');
  }

  const { presignedUrl, publicUrl } = await presignRes.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Error al subir el archivo a R2 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Conexión interrumpida durante la subida a R2.'));
    xhr.send(file);
  });

  return publicUrl;
}
