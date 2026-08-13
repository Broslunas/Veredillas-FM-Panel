import { Mp3Encoder } from '@breezystack/lamejs';

// Sample rate requested from Deepgram Speak for every dubbing segment, and used when
// building the final timeline — keeping this in one place avoids a mismatch between
// what's requested at synthesis time and what's assumed at placement/encoding time.
export const DEFAULT_DUB_SAMPLE_RATE = 24000;

export interface ParsedWav {
  sampleRate: number;
  numChannels: number;
  bitDepth: number;
  samples: Int16Array;
}

/**
 * Parse a standard RIFF/WAVE buffer (as returned by Deepgram Speak when requesting
 * encoding=linear16&container=wav) into its sample rate and raw 16-bit PCM samples.
 * Walks sub-chunks properly instead of assuming a fixed 44-byte header, since header
 * size can legitimately vary.
 */
export function parseWav(buffer: Buffer): ParsedWav {
  if (
    buffer.length < 12 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Datos WAV inválidos: no se encontró la cabecera RIFF/WAVE');
  }

  let offset = 12;
  let sampleRate: number | null = null;
  let numChannels: number | null = null;
  let bitDepth: number | null = null;
  let dataStart: number | null = null;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ') {
      numChannels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitDepth = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === 'data') {
      dataStart = chunkDataStart;
      dataLength = chunkSize;
    }

    // Chunks are word-aligned: a chunk with an odd size has one byte of padding after it.
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (sampleRate === null || numChannels === null || bitDepth === null || dataStart === null) {
    throw new Error('Datos WAV inválidos: falta el chunk "fmt " o "data"');
  }
  if (bitDepth !== 16) {
    throw new Error(`Formato WAV no soportado: se esperaban 16 bits, se recibieron ${bitDepth}`);
  }
  if (numChannels !== 1) {
    throw new Error(`Formato WAV no soportado: se esperaba audio mono, se recibieron ${numChannels} canales`);
  }

  const safeDataLength = Math.min(dataLength, buffer.length - dataStart);
  const sampleCount = Math.floor(safeDataLength / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readInt16LE(dataStart + i * 2);
  }

  return { sampleRate, numChannels, bitDepth, samples };
}

/**
 * Serialize mono 16-bit PCM back into a standard WAV buffer. Used to reassemble a
 * segment's audio into a single storable file when its translated text had to be
 * split across two Deepgram Speak calls (text-too-long retry).
 */
export function encodeMonoPcm16ToWav(samples: Int16Array, sampleRate: number): Buffer {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono, 16-bit)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}

export interface DubPlacement {
  index: number;
  actualStart: number;
  actualEnd: number;
}

export interface DubTimelinePlacer {
  place(index: number, originalStartSeconds: number, samples: Int16Array): void;
  finish(): { pcm: Int16Array; maxDriftSeconds: number; placements: DubPlacement[] };
}

const MIN_GAP_SECONDS = 0.05;

/**
 * Builds the final dubbed-track PCM timeline by placing each block's synthesized
 * audio at `max(originalStart, previousBlockActualEnd + gap)`. This never plays a
 * block earlier than its true original moment (drift is always >= 0), re-anchors to
 * the real timestamp at every natural pause/speaker change, and only allows forward
 * drift to accumulate within an uninterrupted run of blocks. Silence padding between
 * blocks is free — a freshly allocated Int16Array is zero-initialized, and 0 is
 * silence in signed 16-bit PCM.
 */
export function createDubTimelinePlacer(sampleRate: number, initialDurationSeconds: number): DubTimelinePlacer {
  let pcm = new Int16Array(Math.ceil(Math.max(initialDurationSeconds, 1) * 1.05 * sampleRate));
  let previousActualEndSamples = 0;
  let maxDriftSeconds = 0;
  const placements: DubPlacement[] = [];

  function ensureCapacity(neededSamples: number) {
    if (neededSamples <= pcm.length) return;
    const grown = new Int16Array(neededSamples);
    grown.set(pcm);
    pcm = grown;
  }

  return {
    place(index, originalStartSeconds, samples) {
      const originalStartSamples = Math.round(originalStartSeconds * sampleRate);
      const minGapSamples = Math.round(MIN_GAP_SECONDS * sampleRate);
      const actualStartSamples = Math.max(originalStartSamples, previousActualEndSamples + minGapSamples);
      const endSamples = actualStartSamples + samples.length;

      ensureCapacity(endSamples);
      pcm.set(samples, actualStartSamples);
      previousActualEndSamples = endSamples;

      const drift = Math.max(0, (actualStartSamples - originalStartSamples) / sampleRate);
      maxDriftSeconds = Math.max(maxDriftSeconds, drift);

      placements.push({
        index,
        actualStart: actualStartSamples / sampleRate,
        actualEnd: endSamples / sampleRate,
      });
    },
    finish() {
      return { pcm, maxDriftSeconds, placements };
    },
  };
}

/**
 * Encode mono 16-bit PCM to MP3 using the same library already used client-side for
 * audio extraction (lib/workers/mp3-encoder.worker.js), run here in a plain Node
 * context — no ffmpeg or other native binary involved.
 */
export function encodeMonoPcmToMp3(pcm: Int16Array, sampleRate: number, kbps: number = 128): Buffer {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const blockSize = 1152; // multiple of 576, expected by the encoder
  const chunks: Buffer[] = [];

  for (let i = 0; i < pcm.length; i += blockSize) {
    const mp3buf = encoder.encodeBuffer(pcm.subarray(i, i + blockSize));
    if (mp3buf.length > 0) chunks.push(Buffer.from(mp3buf));
  }

  const final = encoder.flush();
  if (final.length > 0) chunks.push(Buffer.from(final));

  return Buffer.concat(chunks);
}
