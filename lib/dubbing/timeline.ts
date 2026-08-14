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
 * Trim near-silence from both ends of a synthesized segment.
 *
 * Aura pads its output with a little silence, which is dead weight inside the segment's
 * time slot. Reclaiming it is free, artifact-free compression: every millisecond removed
 * here is a millisecond `timeCompress` doesn't have to squeeze out of actual speech.
 */
export function trimSilence(samples: Int16Array, sampleRate: number): Int16Array {
  if (samples.length === 0) return samples;

  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const magnitude = samples[i] < 0 ? -samples[i] : samples[i];
    if (magnitude > peak) peak = magnitude;
  }
  if (peak === 0) return samples;

  const threshold = Math.max(48, peak * 0.02);
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  if (start >= end) return samples;

  // Leave a short cushion so words don't sound clipped at the edges.
  const pad = Math.round(0.03 * sampleRate);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length - 1, end + pad);
  return start === 0 && end === samples.length - 1 ? samples : samples.subarray(start, end + 1);
}

/**
 * Time-compress mono PCM by `factor` (>1) using WSOLA
 * (Waveform Similarity Overlap-Add), preserving pitch.
 *
 * Plain overlap-add — which this used to do — splices grains at arbitrary points in the
 * waveform, so successive grains fight each other's phase and the voice takes on the
 * classic metallic/robotic timbre. WSOLA first searches a small neighbourhood for the
 * grain that best matches the natural continuation of what was already written, so the
 * splices land on similar waveform shapes and the result stays smooth and natural.
 */
export function timeCompress(samples: Int16Array, factor: number, sampleRate: number): Int16Array {
  // Below ~3% the saving is inaudible and not worth any processing artifacts at all.
  if (factor <= 1.03 || samples.length === 0) return samples;

  const frameSize = Math.max(4, Math.round(0.03 * sampleRate)); // 30 ms grains
  if (samples.length <= frameSize * 2) return samples;

  const hop = frameSize >> 1; // 50% overlap
  const analysisHop = Math.max(1, Math.round(hop * factor));
  const searchRadius = Math.round(0.005 * sampleRate); // ±5 ms of wiggle room
  const stride = 4; // decimate the similarity search; plenty for speech, 4x cheaper

  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
  }

  const capacity = Math.ceil(samples.length / factor) + frameSize * 2;
  const acc = new Float32Array(capacity);
  const norm = new Float32Array(capacity);
  const lastGrainStart = samples.length - frameSize;

  let inPos = 0;
  let outPos = 0;
  let templatePos = -1; // where the previous grain's natural continuation begins

  while (outPos + frameSize <= capacity) {
    let grainStart = Math.min(inPos, lastGrainStart);

    if (templatePos >= 0 && templatePos + hop <= samples.length) {
      const lo = Math.max(0, Math.min(inPos - searchRadius, lastGrainStart));
      const hi = Math.min(lastGrainStart, inPos + searchRadius);
      let bestScore = -Infinity;
      for (let candidate = lo; candidate <= hi; candidate++) {
        let dot = 0;
        let energy = 0;
        for (let k = 0; k < hop; k += stride) {
          const a = samples[candidate + k];
          dot += a * samples[templatePos + k];
          energy += a * a;
        }
        // Normalised correlation — otherwise the search just drifts toward whichever
        // offset happens to be loudest rather than the one that actually matches.
        const score = dot / Math.sqrt(energy + 1e-6);
        if (score > bestScore) {
          bestScore = score;
          grainStart = candidate;
        }
      }
    }

    if (grainStart < 0 || grainStart + frameSize > samples.length) break;

    for (let i = 0; i < frameSize; i++) {
      const w = window[i];
      acc[outPos + i] += samples[grainStart + i] * w;
      norm[outPos + i] += w;
    }

    templatePos = grainStart + hop;
    outPos += hop;
    inPos = grainStart + analysisHop;
    if (inPos + frameSize > samples.length) break;
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
  const ordered = [...segments]
    .sort((a, b) => a.start - b.start || a.index - b.index)
    // Reclaim Aura's padding first — free headroom that reduces (often removes) the
    // need to time-compress the speech itself further down.
    .map((s) => ({ ...s, samples: trimSilence(s.samples, sampleRate) }));

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
