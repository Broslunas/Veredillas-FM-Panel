// Simulates dense podcast conversations (overlapping speakers, out-of-order utterances,
// and synthesized lines that run longer than the source) and asserts the assembled dub
// timeline stays in sync instead of accumulating drift.
//
// Run: node --experimental-strip-types scripts/verify-dub-sync.mjs
import { assembleDubTimeline, timeCompress, DEFAULT_DUB_SAMPLE_RATE } from '../lib/dubbing/timeline.ts';

const SR = DEFAULT_DUB_SAMPLE_RATE;
const LIMIT = 1.05; // MAX_LATE_SECONDS (1.0) + rounding slack

function tone(seconds) {
  const n = Math.max(1, Math.round(seconds * SR));
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SR));
  return s;
}

/**
 * @param gapBetweenTurns silence between turns in the SOURCE audio
 * @param expansion how much longer the synthesized dub is vs. the original line
 * @param crosstalk whether every 3rd turn starts before the previous one ended
 *                  (Deepgram returns these utterances out of chronological order)
 */
function scenario(label, { turns = 500, spoken = 3.5, gapBetweenTurns, expansion, crosstalk }) {
  const segments = [];
  let t = 0;
  for (let i = 0; i < turns; i++) {
    const overlaps = crosstalk && i % 3 === 2;
    segments.push({
      index: i,
      start: Math.max(0, overlaps ? t - 1.2 : t),
      samples: tone(spoken * expansion),
    });
    t += spoken + gapBetweenTurns;
  }

  const { pcm, maxSpeedFactor, placements } = assembleDubTimeline(segments, SR, t);

  const byIndex = new Map(placements.map((p) => [p.index, p]));
  let worst = 0;
  for (const seg of segments) {
    worst = Math.max(worst, byIndex.get(seg.index).actualStart - seg.start);
  }

  const ok = worst <= LIMIT;
  console.log(
    `${ok ? 'OK  ' : 'FALLO'} ${label.padEnd(44)} desfase máx ${worst.toFixed(2)}s` +
      ` · compresión ${maxSpeedFactor.toFixed(2)}x · ${(pcm.length / SR / 60).toFixed(1)} min`
  );
  return ok;
}

console.log(`Límite de desfase admitido: ${LIMIT}s\n`);

const results = [
  scenario('habla continua, dub 1.25x', { gapBetweenTurns: 0, expansion: 1.25, crosstalk: false }),
  scenario('pausa 0.4s, dub 1.5x (rompía el anterior)', { gapBetweenTurns: 0.4, expansion: 1.5, crosstalk: false }),
  scenario('pausa 0.4s, dub 2.0x (caso extremo)', { gapBetweenTurns: 0.4, expansion: 2.0, crosstalk: false }),
  scenario('voces solapadas + dub 1.5x', { gapBetweenTurns: 0.4, expansion: 1.5, crosstalk: true }),
  scenario('voces solapadas, sin pausas, dub 1.6x', { gapBetweenTurns: 0, expansion: 1.6, crosstalk: true }),
];

if (results.some((r) => !r)) {
  console.error('\nFALLO: al menos un escenario supera el límite de desfase.');
  process.exit(1);
}
console.log('\nOK: el desfase se mantiene acotado en todos los escenarios.');

/* ------------------------------------------------------------------ */
/* Audio quality: robotic artifacts show up as amplitude ripple where   */
/* grains are spliced. On a steady vowel the envelope should stay flat. */
/* ------------------------------------------------------------------ */

// Vowel-like: a fundamental plus harmonics, steady amplitude.
function vowel(seconds, f0 = 120) {
  const n = Math.round(seconds * SR);
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v =
      Math.sin(2 * Math.PI * f0 * t) +
      0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) +
      0.3 * Math.sin(2 * Math.PI * 3 * f0 * t);
    s[i] = Math.round(6000 * v);
  }
  return s;
}

// Coefficient of variation of the short-term RMS envelope: 0 = perfectly steady,
// higher = the pumping/metallic modulation that reads as "robotic".
function envelopeRipple(samples) {
  const win = Math.round(0.01 * SR);
  const rms = [];
  for (let i = win; i + win <= samples.length - win; i += win) {
    let sum = 0;
    for (let k = 0; k < win; k++) sum += samples[i + k] * samples[i + k];
    rms.push(Math.sqrt(sum / win));
  }
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const variance = rms.reduce((a, b) => a + (b - mean) ** 2, 0) / rms.length;
  return Math.sqrt(variance) / mean;
}

console.log('\nCalidad de la compresión (ondulación de amplitud, menor = más natural):');
const source = vowel(3);
console.log(`  sin comprimir (referencia)      ${envelopeRipple(source).toFixed(3)}`);
let qualityOk = true;
for (const factor of [1.2, 1.4, 1.6]) {
  const ripple = envelopeRipple(timeCompress(source, factor, SR));
  const ok = ripple < 0.1;
  if (!ok) qualityOk = false;
  console.log(`  WSOLA ${factor.toFixed(1)}x${' '.repeat(20)} ${ripple.toFixed(3)}  ${ok ? '' : '<-- artefactos audibles'}`);
}

const t0 = Date.now();
timeCompress(vowel(60), 1.4, SR);
console.log(`\nRendimiento: 60 s de audio comprimidos en ${Date.now() - t0} ms`);

if (!qualityOk) {
  console.error('\nFALLO: la compresión introduce demasiada ondulación (sonaría robótico).');
  process.exit(1);
}
console.log('OK: la compresión mantiene la envolvente estable.');
