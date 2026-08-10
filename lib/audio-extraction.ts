export type ExtractionStage = 'downloading' | 'decoding' | 'encoding' | 'uploading';

export interface ExtractionProgress {
  stage: ExtractionStage;
  percent: number | null; // 0-100, null = indeterminate
  etaSeconds: number | null;
  loadedBytes?: number;
  totalBytes?: number;
}

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function fetchArrayBufferWithProgress(
  url: string,
  onProgress: (loadedBytes: number, totalBytes: number, etaSeconds: number | null) => void
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar el vídeo desde R2');

  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? parseInt(totalHeader, 10) : 0;

  if (!res.body || !total) {
    const buffer = await res.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength, 0);
    return buffer;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const startTime = performance.now();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      const elapsedSeconds = (performance.now() - startTime) / 1000;
      const speed = loaded / Math.max(elapsedSeconds, 0.001);
      const etaSeconds = speed > 0 ? (total - loaded) / speed : null;
      onProgress(loaded, total, etaSeconds);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

// Runs the actual MP3 encoding (CPU-heavy, pure JS) off the main thread so the
// tab doesn't freeze/"page unresponsive" while processing a long episode.
function encodeAudioBufferToMp3(
  buffer: AudioBuffer,
  onProgress: (percent: number, etaSeconds: number | null) => void,
  kbps = 128
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/mp3-encoder.worker.js', import.meta.url), { type: 'module' });
    const startTime = performance.now();

    worker.onmessage = (
      event: MessageEvent<{ type: string; chunks?: Uint8Array[]; error?: string; progress?: number }>
    ) => {
      const data = event.data;
      if (data.type === 'progress' && typeof data.progress === 'number') {
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const etaSeconds = data.progress > 0.01 ? (elapsedSeconds / data.progress) * (1 - data.progress) : null;
        onProgress(Math.min(99, Math.round(data.progress * 100)), etaSeconds);
        return;
      }

      worker.terminate();
      if (data.type === 'error') {
        reject(new Error(data.error || 'Error al codificar el audio a MP3'));
        return;
      }
      onProgress(100, 0);
      resolve(new Blob((data.chunks || []) as BlobPart[], { type: 'audio/mpeg' }));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Error en el worker de codificación MP3'));
    };

    // Copy the channel data so its buffer can be transferred (zero-copy) to
    // the worker instead of structured-cloned.
    const left = buffer.getChannelData(0).slice();
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : null;
    const transfer = right ? [left.buffer, right.buffer] : [left.buffer];

    worker.postMessage({ left, right, sampleRate: buffer.sampleRate, kbps }, transfer);
  });
}

async function videoArrayBufferToMp3(
  arrayBuffer: ArrayBuffer,
  onProgress: (progress: ExtractionProgress) => void
): Promise<Blob> {
  onProgress({ stage: 'decoding', percent: null, etaSeconds: null });
  const audioContext = new AudioContext();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  return encodeAudioBufferToMp3(decodedBuffer, (percent, etaSeconds) => {
    onProgress({ stage: 'encoding', percent, etaSeconds });
  });
}

export async function extractMp3FromVideoFile(
  file: File,
  onProgress: (progress: ExtractionProgress) => void
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  return videoArrayBufferToMp3(arrayBuffer, onProgress);
}

export async function extractMp3FromVideoUrl(
  url: string,
  onProgress: (progress: ExtractionProgress) => void
): Promise<Blob> {
  const arrayBuffer = await fetchArrayBufferWithProgress(url, (loadedBytes, totalBytes, etaSeconds) => {
    onProgress({
      stage: 'downloading',
      percent: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : null,
      etaSeconds,
      loadedBytes,
      totalBytes,
    });
  });
  return videoArrayBufferToMp3(arrayBuffer, onProgress);
}
