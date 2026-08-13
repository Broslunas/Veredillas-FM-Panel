import type { ParsedWav } from './timeline';

/**
 * Browser-safe mirror of lib/dubbing/audio.ts's `parseWav` — same RIFF/WAVE chunk
 * walk, but reading from a plain `ArrayBuffer`/`DataView` instead of Node's `Buffer`,
 * since this runs client-side (see components/DubbingManager.tsx's assembly step).
 */
export function parseWavArrayBuffer(buffer: ArrayBuffer): ParsedWav {
  const view = new DataView(buffer);
  const asciiAt = (offset: number, length: number) => {
    let out = '';
    for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
    return out;
  };

  if (buffer.byteLength < 12 || asciiAt(0, 4) !== 'RIFF' || asciiAt(8, 4) !== 'WAVE') {
    throw new Error('Datos WAV inválidos: no se encontró la cabecera RIFF/WAVE');
  }

  let offset = 12;
  let sampleRate: number | null = null;
  let numChannels: number | null = null;
  let bitDepth: number | null = null;
  let dataStart: number | null = null;
  let dataLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = asciiAt(offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(chunkDataStart + 2, true);
      sampleRate = view.getUint32(chunkDataStart + 4, true);
      bitDepth = view.getUint16(chunkDataStart + 14, true);
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

  const safeDataLength = Math.min(dataLength, buffer.byteLength - dataStart);
  const sampleCount = Math.floor(safeDataLength / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(dataStart + i * 2, true);
  }

  return { sampleRate, numChannels, bitDepth, samples };
}
