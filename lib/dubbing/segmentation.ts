import { extractDeepgramWords, type DeepgramResponse, type DeepgramWord } from '@/lib/deepgram';

export interface DubBlock {
  index: number;
  start: number;
  end: number;
  speaker?: number;
  text: string;
}

// Gap between words (seconds) that marks a natural pause worth re-anchoring on.
const GAP_THRESHOLD_SECONDS = 1.5;
// Safety cap on a block's SOURCE text length, well under Deepgram Speak's ~2000-char
// per-request limit even after translation may expand it. Also doubles as a forced
// re-anchor point roughly once a minute during long uninterrupted monologues, which
// would otherwise never hit the silence-gap condition above.
const MAX_BLOCK_CHARS = 900;

/**
 * Group a Deepgram transcription's word-level timestamps into speaker-turn blocks,
 * each carrying its ORIGINAL start/end from the source audio. A block ends when the
 * speaker changes, a silence gap >= GAP_THRESHOLD_SECONDS occurs, the accumulated text
 * exceeds MAX_BLOCK_CHARS, or the words run out.
 */
export function buildDubBlocks(data: DeepgramResponse): DubBlock[] {
  const words = extractDeepgramWords(data);
  if (words.length === 0) return [];

  const blocks: DubBlock[] = [];
  let current: DeepgramWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const text = current.map((w) => w.word).join(' ').trim();
    if (text) {
      blocks.push({
        index: blocks.length,
        start: current[0].start,
        end: current[current.length - 1].end,
        speaker: current[0].speaker,
        text,
      });
    }
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    current.push(w);

    const next = words[i + 1];
    const isLast = i === words.length - 1;
    const currentLength = current.map((cw) => cw.word).join(' ').length;
    const speakerChanges = Boolean(next && next.speaker !== w.speaker);
    const hasGap = Boolean(next && next.start - w.end >= GAP_THRESHOLD_SECONDS);
    const tooLong = currentLength >= MAX_BLOCK_CHARS;

    if (isLast || speakerChanges || hasGap || tooLong) {
      flush();
    }
  }

  flush();

  return blocks;
}
