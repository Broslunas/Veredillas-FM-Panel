const GENERIC_SPEAKER_REGEX = /^hablante\s*\d+$/i;

// Mirrors timeStrToSeconds() in components/EpisodeEditorForm.tsx — kept as a separate
// copy since that one is client-only and this runs in a server route.
function timeStrToSeconds(time: string): number {
  const parts = (time || '0:00').split(':').map((p) => parseInt(p, 10));
  const nums = parts.map((p) => (Number.isNaN(p) ? 0 : p));
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] || 0;
}

export interface ExistingTranscriptionLine {
  time: string;
  text?: string;
  speaker?: string;
}

/**
 * Map each numeric diarization speaker id from a FRESH Deepgram re-transcription to a
 * human name, by borrowing whatever names the admin already assigned in the episode's
 * saved transcript (Speaker Identification panel in the editor). The fresh
 * re-transcription's speaker numbering isn't guaranteed to line up with the old one
 * (diarization isn't perfectly deterministic run-to-run), so each block is matched to
 * the closest-in-time already-named line instead of assuming ids correspond directly;
 * each numeric id then takes whichever name its blocks matched most often.
 */
export function resolveSpeakerNames(
  blocks: { speaker?: number; start: number }[],
  existingTranscription: ExistingTranscriptionLine[] | undefined
): Record<number, string> {
  const names: Record<number, string> = {};
  if (!Array.isArray(existingTranscription) || existingTranscription.length === 0) return names;

  const namedLines = existingTranscription
    .map((t) => ({ start: timeStrToSeconds(t.time), speaker: (t.speaker || '').trim() }))
    .filter((t) => t.speaker && !GENERIC_SPEAKER_REGEX.test(t.speaker));

  if (namedLines.length === 0) return names;

  const MAX_MATCH_DISTANCE_SECONDS = 30;
  const votes = new Map<number, Map<string, number>>();

  for (const block of blocks) {
    const speakerId = block.speaker ?? 0;

    let closest = namedLines[0];
    let bestDist = Math.abs(closest.start - block.start);
    for (const line of namedLines) {
      const dist = Math.abs(line.start - block.start);
      if (dist < bestDist) {
        closest = line;
        bestDist = dist;
      }
    }
    if (bestDist > MAX_MATCH_DISTANCE_SECONDS) continue;

    if (!votes.has(speakerId)) votes.set(speakerId, new Map());
    const speakerVotes = votes.get(speakerId)!;
    speakerVotes.set(closest.speaker, (speakerVotes.get(closest.speaker) || 0) + 1);
  }

  for (const [speakerId, speakerVotes] of votes) {
    let bestName = '';
    let bestCount = 0;
    for (const [name, count] of speakerVotes) {
      if (count > bestCount) {
        bestName = name;
        bestCount = count;
      }
    }
    if (bestName) names[speakerId] = bestName;
  }

  return names;
}
