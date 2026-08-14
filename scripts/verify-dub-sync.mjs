// Simulates dense podcast conversations (overlapping speakers, out-of-order utterances,
// and synthesized lines that run longer than the source) and asserts the assembled dub
// timeline stays in sync instead of accumulating drift.
//
// Run: node --experimental-strip-types scripts/verify-dub-sync.mjs
import { assembleDubTimeline, DEFAULT_DUB_SAMPLE_RATE } from '../lib/dubbing/timeline.ts';

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
