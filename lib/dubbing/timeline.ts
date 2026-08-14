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

export interface DubSegmentInput {
  index: number;
  /** ORIGINAL start time in the source media, in seconds. */
  start: number;
  samples: Int16Array;
}

export interface DubAssemblyResult {
  pcm: Int16Array;
  /** Worst single-segment lateness vs. its original timestamp. Bounded by MAX_LATE_SECONDS. */
  maxDriftSeconds: number;
  maxSpeedFactor: number;
  placements: DubPlacement[];
}

const MIN_GAP_SECONDS = 0.05;

/**
 * Hard ceiling on how late any single segment may start relative to its ORIGINAL
 * timestamp. This is the property that actually keeps the dub in sync: drift is
 * clamped per-segment instead of being carried forward, so it can never compound
 * across an episode (the previous implementation pushed each segment past the end
 * of the last one with no ceiling, which is how a long podcast ended up minutes
 * out of sync by the end).
 */
const MAX_LATE_SECONDS = 1.0;

/**
 * How much a segment may be time-compressed to fit its slot. Higher than a naive
 * resampling cap would allow because `timeCompress` below preserves pitch, so the
 * voice speeds up without turning chipmunky.
 */
const MAX_SPEED_FACTOR = 1.6;

function clampInt16(value: number): number {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value | 0;
}

/**
 * Time-compress mono PCM by `factor` (>1) using overlap-add (OLA) with a Hann window.
 *
 * Unlike plain resampling (which is what this used to do), OLA keeps the PITCH intact
 * — it drops overlapping grains of audio rather than replaying everything faster. That
 * is what makes a meaningful compression range usable: a 1.5x resampled voice sounds
 * cartoonish, whereas 1.5x OLA just sounds like someone talking briskly.
 */
export function timeCompress(samples: Int16Array, factor: number, sampleRate: number): Int16Array {
  if (factor <= 1.0001 || samples.length === 0) return samples;

  const frameSize = Math.max(2, Math.round(0.04 * sampleRate)); // 40 ms grains
  if (samples.length <= frameSize) return samples;

  const synthesisHop = Math.round(frameSize / 2); // 50% overlap
  const analysisHop = Math.max(1, Math.round(synthesisHop * factor));

  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
  }

  const capacity = Math.ceil(samples.length / factor) + frameSize * 2;
  const acc = new Float32Array(capacity);
  const norm = new Float32Array(capacity);

  let inPos = 0;
  let outPos = 0;
  while (inPos + frameSize <= samples.length && outPos + frameSize <= capacity) {
    for (let i = 0; i < frameSize; i++) {
      const w = window[i];
      acc[outPos + i] += samples[inPos + i] * w;
      norm[outPos + i] += w;
    }
    inPos += analysisHop;
    outPos += synthesisHop;
  }

  const outLength = Math.min(capacity, outPos + frameSize);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    // Normalising by the summed window weight keeps amplitude flat across the
    // ramp-in/ramp-out regions where fewer grains overlap.
    const weight = norm[i] > 1e-6 ? norm[i] : 1;
    out[i] = clampInt16(Math.round(acc[i] / weight));
  }
  return out;
}

/**
 * Builds the final dubbed-track PCM timeline.
 *
 * Every segment is anchored to its ORIGINAL timestamp and may only be at most
 * MAX_LATE_SECONDS late, so timing errors never accumulate. To make that anchoring
 * possible without talking over the next line, a segment whose synthesized audio
 * would overrun its slot is time-compressed (pitch-preserving) by up to
 * MAX_SPEED_FACTOR first.
 *
 * When even that isn't enough, segments are MIXED rather than pushed — deliberately.
 * Overlap mostly arises where speakers already overlapped in the source (Deepgram
 * emits overlapping utterances for crosstalk), so a brief overlap in the dub is both
 * truer to the original and far less damaging than silently sliding everything after
 * it out of sync.
 *
 * Input order doesn't matter: segments are sorted by original start time here, which
 * matters because overlapping-speaker utterances do NOT come back in chronological
 * order from Deepgram.
 */
export function assembleDubTimeline(
  segments: DubSegmentInput[],
  sampleRate: number,
  initialDurationSeconds: number
): DubAssemblyResult {
  const ordered = [...segments].sort((a, b) => a.start - b.start || a.index - b.index);

  let pcm = new Int16Array(Math.ceil(Math.max(initialDurationSeconds, 1) * 1.05 * sampleRate));
  const placements: DubPlacement[] = [];
  const minGapSamples = Math.round(MIN_GAP_SECONDS * sampleRate);
  const maxLateSamples = Math.round(MAX_LATE_SECONDS * sampleRate);

  let previousEndSamples = 0;
  let maxDriftSeconds = 0;
  let maxSpeedFactor = 1;

  function ensureCapacity(neededSamples: number) {
    if (neededSamples <= pcm.length) return;
    const grown = new Int16Array(Math.ceil(neededSamples * 1.25));
    grown.set(pcm);
    pcm = grown;
  }

  for (let i = 0; i < ordered.length; i++) {
    const segment = ordered[i];
    const originalStartSamples = Math.max(0, Math.round(segment.start * sampleRate));

    // Never play a line early; never let it be more than MAX_LATE_SECONDS late either.
    const preferredStart = previousEndSamples + minGapSamples;
    const actualStartSamples = Math.min(
      Math.max(originalStartSamples, preferredStart),
      originalStartSamples + maxLateSamples
    );

    let toPlace = segment.samples;
    const next = ordered[i + 1];
    if (next) {
      const nextOriginalStartSamples = Math.max(0, Math.round(next.start * sampleRate));
      // The next line gets the same lateness allowance, so this one may borrow it.
      const availableSamples = nextOriginalStartSamples + maxLateSamples - minGapSamples - actualStartSamples;
      if (availableSamples > 0 && toPlace.length > availableSamples) {
        const factor = Math.min(MAX_SPEED_FACTOR, toPlace.length / availableSamples);
        toPlace = timeCompress(toPlace, factor, sampleRate);
        maxSpeedFactor = Math.max(maxSpeedFactor, factor);
      }
    }

    const endSamples = actualStartSamples + toPlace.length;
    ensureCapacity(endSamples);

    // Additive mix (not overwrite): where two segments overlap, both stay audible
    // instead of the later one silently truncating the earlier one's tail.
    for (let j = 0; j < toPlace.length; j++) {
      const at = actualStartSamples + j;
      const existing = pcm[at];
      pcm[at] = existing === 0 ? toPlace[j] : clampInt16(existing + toPlace[j]);
    }

    previousEndSamples = Math.max(previousEndSamples, endSamples);

    const drift = (actualStartSamples - originalStartSamples) / sampleRate;
    maxDriftSeconds = Math.max(maxDriftSeconds, drift);

    placements.push({
      index: segment.index,
      actualStart: actualStartSamples / sampleRate,
      actualEnd: endSamples / sampleRate,
    });
  }

  // Trim trailing silence from the over-allocated buffer so the exported duration
  // reflects the real content length.
  const usedLength = Math.min(pcm.length, previousEndSamples);
  const finalPcm = usedLength === pcm.length ? pcm : pcm.subarray(0, usedLength);

  return { pcm: finalPcm, maxDriftSeconds, maxSpeedFactor, placements };
}
