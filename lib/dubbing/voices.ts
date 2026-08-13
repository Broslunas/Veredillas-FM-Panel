import type { AuraVoice } from '@/lib/deepgram';

/**
 * Voices whose `languages` includes `targetLang` (exact match or a `xx-YY` variant
 * of it, e.g. `en` matches `en-US`).
 */
export function filterVoicesForLanguage(voices: AuraVoice[], targetLang: string): AuraVoice[] {
  return voices.filter((v) =>
    Array.isArray(v.languages) && v.languages.some((l) => l === targetLang || l.startsWith(`${targetLang}-`))
  );
}

/**
 * Assign each distinct speaker id detected by Deepgram's diarization to a distinct
 * Aura voice for the target language, rotating through the available voices so
 * different speakers in the episode get different voices in the dub.
 */
export function mapSpeakersToVoices(
  speakerIds: number[],
  voices: AuraVoice[],
  targetLang: string
): Record<string, string> {
  const candidates = filterVoicesForLanguage(voices, targetLang);
  if (candidates.length === 0) {
    throw new Error(`No hay voces Aura disponibles para el idioma "${targetLang}"`);
  }

  const uniqueSpeakerIds = Array.from(new Set(speakerIds));
  const map: Record<string, string> = {};
  uniqueSpeakerIds.forEach((id, i) => {
    map[String(id)] = candidates[i % candidates.length].canonical_name;
  });

  return map;
}
