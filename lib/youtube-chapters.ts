const CHAPTER_TIME_REGEX = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

function parseChapterTimeToSeconds(time: string): number | null {
  const trimmed = (time || '').trim();
  if (!CHAPTER_TIME_REGEX.test(trimmed)) return null;
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function formatSecondsForYouTube(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const secsStr = String(secs).padStart(2, '0');
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${secsStr}`;
  return `${mins}:${secsStr}`;
}

interface ChapterSection {
  title: string;
  time: string;
}

/**
 * Formats episode chapters as a YouTube description block. YouTube only
 * renders chapters when there are 3+ entries, ascending, starting at 0:00 —
 * so a synthetic "Introducción" chapter is prepended when needed.
 */
export function formatChaptersForYouTubeDescription(sections: ChapterSection[]): string | null {
  const parsed = (sections || [])
    .map((s) => ({ title: s.title?.trim(), seconds: parseChapterTimeToSeconds(s.time) }))
    .filter((s): s is { title: string; seconds: number } => !!s.title && s.seconds !== null)
    .sort((a, b) => a.seconds - b.seconds);

  if (parsed.length === 0) return null;

  if (parsed[0].seconds > 0) {
    parsed.unshift({ title: 'Introducción', seconds: 0 });
  }

  const lines = parsed.map((s) => `${formatSecondsForYouTube(s.seconds)} ${s.title}`);
  return `Capítulos:\n${lines.join('\n')}`;
}
