// Portable (server AND browser) dubbing-timeline logic — deliberately free of Node-only
// APIs like `Buffer` so it can be imported both from API routes and from client components
// (the actual assembly now runs in the browser; see components/DubbingManager.tsx).

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

export interface DubPlacement {
  index: number;
  actualStart: number;
  actualEnd: number;
}

export interface DubTimelinePlacer {
  /**
   * `nextOriginalStartSeconds` — the ORIGINAL start time of the block that will be
   * placed right after this one (or undefined for the last block). Used to speed up
   * this segment's audio when it would otherwise run past that point, so it doesn't
   * push every later line later too.
   */
  place(index: number, originalStartSeconds: number, samples: Int16Array, nextOriginalStartSeconds?: number): void;
  finish(): { pcm: Int16Array; maxDriftSeconds: number; maxSpeedFactor: number; placements: DubPlacement[] };
}

const MIN_GAP_SECONDS = 0.05;

// How much a segment's synthesized audio may be sped up (via resampling) to fit
// within its original time slot. Kept modest so voices don't distort noticeably —
// beyond this, a little residual drift is preferable to unintelligible audio.
const MAX_SPEED_FACTOR = 1.35;

/**
 * Speeds up mono PCM by `factor` (>1) using linear-interpolation resampling — the
 * same technique as playing audio at a faster rate. This does shift pitch slightly,
 * but for the modest factors this is capped to it stays intelligible, and it keeps
 * the implementation dependency-free (no ffmpeg / native binary involved).
 */
export function speedUpPcm(samples: Int16Array, factor: number): Int16Array {
  if (factor <= 1 || samples.length === 0) return samples;
  const outLength = Math.max(1, Math.round(samples.length / factor));
  const out = new Int16Array(outLength);
  const lastIndex = samples.length - 1;
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * factor;
    const idx0 = Math.min(lastIndex, Math.floor(srcPos));
    const idx1 = Math.min(lastIndex, idx0 + 1);
    const frac = srcPos - idx0;
    out[i] = Math.round(samples[idx0] * (1 - frac) + samples[idx1] * frac);
  }
  return out;
}

/**
 * Builds the final dubbed-track PCM timeline by placing each block's synthesized
 * audio at `max(originalStart, previousBlockActualEnd + gap)`. This never plays a
 * block earlier than its true original moment (drift is always >= 0) and re-anchors
 * to the real timestamp at every natural pause/speaker change. Before placing, if a
 * block's synthesized audio would run past the next block's original start (which is
 * the common case in dense conversation, where translated speech often runs longer
 * than the source), it's sped up just enough to fit — capped at MAX_SPEED_FACTOR —
 * so drift doesn't keep compounding across an entire uninterrupted run of blocks.
 * Silence padding between blocks is free — a freshly allocated Int16Array is
 * zero-initialized, and 0 is silence in signed 16-bit PCM.
 */
export function createDubTimelinePlacer(sampleRate: number, initialDurationSeconds: number): DubTimelinePlacer {
  let pcm = new Int16Array(Math.ceil(Math.max(initialDurationSeconds, 1) * 1.05 * sampleRate));
  let previousActualEndSamples = 0;
  let maxDriftSeconds = 0;
  let maxSpeedFactor = 1;
  const placements: DubPlacement[] = [];
  const minGapSamples = Math.round(MIN_GAP_SECONDS * sampleRate);

  function ensureCapacity(neededSamples: number) {
    if (neededSamples <= pcm.length) return;
    const grown = new Int16Array(neededSamples);
    grown.set(pcm);
    pcm = grown;
  }

  return {
    place(index, originalStartSeconds, samples, nextOriginalStartSeconds) {
      const originalStartSamples = Math.round(originalStartSeconds * sampleRate);
      const actualStartSamples = Math.max(originalStartSamples, previousActualEndSamples + minGapSamples);

      let toPlace = samples;
      if (typeof nextOriginalStartSeconds === 'number') {
        const nextOriginalStartSamples = Math.round(nextOriginalStartSeconds * sampleRate);
        const availableSamples = nextOriginalStartSamples - minGapSamples - actualStartSamples;
        if (availableSamples > 0 && samples.length > availableSamples) {
          const neededFactor = samples.length / availableSamples;
          const factor = Math.min(MAX_SPEED_FACTOR, neededFactor);
          toPlace = speedUpPcm(samples, factor);
          maxSpeedFactor = Math.max(maxSpeedFactor, factor);
        }
      }

      const endSamples = actualStartSamples + toPlace.length;

      ensureCapacity(endSamples);
      pcm.set(toPlace, actualStartSamples);
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
      return { pcm, maxDriftSeconds, maxSpeedFactor, placements };
    },
  };
}
