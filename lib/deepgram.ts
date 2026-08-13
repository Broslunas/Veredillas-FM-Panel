/**
 * Deepgram API Helper Utilities for Veredillas FM Panel
 */

export interface DeepgramTranscribeOptions {
  model?: string;
  language?: string;
  smartFormat?: boolean;
  diarize?: boolean;
  punctuate?: boolean;
  paragraphs?: boolean;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker?: number;
}

export interface ShortSubtitleSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

export interface DeepgramResponse {
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info?: Record<string, any>;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript: string;
        confidence: number;
        words: DeepgramWord[];
        paragraphs?: {
          paragraphs: Array<{
            sentences: Array<{
              text: string;
              start: number;
              end: number;
            }>;
            speaker?: number;
            num_words: number;
            start: number;
            end: number;
          }>;
        };
      }>;
    }>;
    utterances?: DeepgramUtterance[];
  };
}

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '25b93ff4efc0e9b7b27b7e89834fc6736874da19';

/**
 * Transcribe media from Buffer or URL
 */
export async function transcribeMedia(
  source: Buffer | ArrayBuffer | string,
  options: DeepgramTranscribeOptions = {},
  contentType: string = 'audio/mp3'
): Promise<DeepgramResponse> {
  const model = options.model || 'nova-3';
  const language = options.language || 'es';
  const smartFormat = options.smartFormat ?? true;
  const diarize = options.diarize ?? true;
  const punctuate = options.punctuate ?? true;

  const params = new URLSearchParams({
    model,
    language,
    smart_format: String(smartFormat),
    diarize: String(diarize),
    punctuate: String(punctuate),
    utterances: 'true',
    utt_split: '0.6', // Smaller utterance split threshold for shorter phrases
  });

  const isUrl = typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'));

  const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;

  const headers: Record<string, string> = {
    Authorization: `Token ${DEEPGRAM_API_KEY}`,
  };

  let body: any;

  if (isUrl) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ url: source });
  } else {
    headers['Content-Type'] = contentType || 'application/octet-stream';
    body = source;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Deepgram API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Extract a flat, speaker-tagged word list from a Deepgram transcription response,
 * preferring per-utterance words (each carrying the utterance's speaker) and falling
 * back to the first channel/alternative's word list.
 */
export function extractDeepgramWords(data: DeepgramResponse): DeepgramWord[] {
  let words: DeepgramWord[] = [];
  const utterances = data.results?.utterances;

  if (utterances && utterances.length > 0) {
    for (const utt of utterances) {
      if (utt.words && utt.words.length > 0) {
        const uttWords = utt.words.map((w) => ({
          ...w,
          speaker: w.speaker ?? utt.speaker,
        }));
        words.push(...uttWords);
      }
    }
  }

  if (words.length === 0) {
    words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  }

  return words;
}

/**
 * Segment transcript into short, clean subtitle-style chunks (max 6-8 words / punctuation breaks)
 */
export function segmentIntoShortSubtitles(data: DeepgramResponse): ShortSubtitleSegment[] {
  const words = extractDeepgramWords(data);

  if (words.length === 0) {
    const rawText = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    if (!rawText.trim()) return [];

    const clauses = rawText.match(/[^.!?,;:]+[.!?,;:]?/g) || [rawText];
    let currentTime = 0;
    return clauses.map((c) => {
      const trimmed = c.trim();
      const duration = Math.max(1.2, trimmed.split(' ').length * 0.35);
      const seg = {
        start: currentTime,
        end: currentTime + duration,
        text: trimmed,
        speaker: 0,
      };
      currentTime += duration;
      return seg;
    });
  }

  const segments: ShortSubtitleSegment[] = [];
  let currentWords: DeepgramWord[] = [];
  let segmentStart = words[0].start;
  let currentSpeaker = words[0].speaker;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (currentWords.length === 0) {
      segmentStart = w.start;
      currentSpeaker = w.speaker;
    }

    currentWords.push(w);

    const isLastWord = i === words.length - 1;
    const nextWord = words[i + 1];

    const hasPunctuation = /[.!?,;:]$/.test(w.word);
    const hasTimeGap = Boolean(nextWord && nextWord.start - w.end >= 0.4);
    const speakerChanged = Boolean(nextWord && nextWord.speaker !== currentSpeaker);
    const currentLength = currentWords.map((cw) => cw.word).join(' ').length;
    const isTooLong = currentWords.length >= 7 || currentLength >= 42;

    if (hasPunctuation || hasTimeGap || speakerChanged || isTooLong || isLastWord) {
      const textStr = currentWords.map((cw) => cw.word).join(' ').trim();
      if (textStr) {
        segments.push({
          start: segmentStart,
          end: w.end,
          text: textStr,
          speaker: currentSpeaker,
        });
      }
      currentWords = [];
    }
  }

  return segments;
}

/**
 * Format timestamp to SRT time format: HH:MM:SS,mmm
 */
function formatSRTTime(seconds: number): string {
  const date = new Date(0);
  date.setUTCMilliseconds(Math.round(seconds * 1000));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * Format timestamp to WebVTT time format: HH:MM:SS.mmm
 */
function formatVTTTime(seconds: number): string {
  return formatSRTTime(seconds).replace(',', '.');
}

/**
 * Convert Deepgram Response to SRT Subtitles (Short, clean lines)
 */
export function convertToSRT(data: DeepgramResponse): string {
  const segments = segmentIntoShortSubtitles(data);

  if (segments.length === 0) {
    return '1\n00:00:00,000 --> 00:00:05,000\n[Sin transcripción disponible]\n';
  }

  return segments
    .map((seg, i) => {
      const index = i + 1;
      const startTime = formatSRTTime(seg.start);
      const endTime = formatSRTTime(seg.end);
      const speakerPrefix = seg.speaker !== undefined ? `[Hablante ${seg.speaker}] ` : '';
      return `${index}\n${startTime} --> ${endTime}\n${speakerPrefix}${seg.text}\n`;
    })
    .join('\n');
}

/**
 * Convert Deepgram Response to WebVTT Subtitles (Short, clean lines)
 */
export function convertToVTT(data: DeepgramResponse): string {
  const segments = segmentIntoShortSubtitles(data);
  const header = 'WEBVTT\n\n';

  if (segments.length === 0) {
    return header + '00:00:00.000 --> 00:00:05.000\n[Sin transcripción disponible]\n';
  }

  const body = segments
    .map((seg) => {
      const startTime = formatVTTTime(seg.start);
      const endTime = formatVTTTime(seg.end);
      const speakerTag = seg.speaker !== undefined ? `<v Hablante ${seg.speaker}>` : '';
      return `${startTime} --> ${endTime}\n${speakerTag}${seg.text}\n`;
    })
    .join('\n');

  return header + body;
}

/**
 * Fetch complete Deepgram Stats for Admin & Owner
 */
export async function getDeepgramAdminStats() {
  const headers = { Authorization: `Token ${DEEPGRAM_API_KEY}` };

  const projRes = await fetch('https://api.deepgram.com/v1/projects', { headers });
  if (!projRes.ok) throw new Error('Error al obtener proyectos de Deepgram');
  const projData = await projRes.json();
  const projects = projData.projects || [];

  if (projects.length === 0) {
    return { projects: [], stats: null };
  }

  const primaryProject = projects[0];
  const projectId = primaryProject.project_id;

  const [balanceRes, usageRes, keysRes, reqsRes, modelsRes] = await Promise.all([
    fetch(`https://api.deepgram.com/v1/projects/${projectId}/balances`, { headers }),
    fetch(`https://api.deepgram.com/v1/projects/${projectId}/usage`, { headers }),
    fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, { headers }),
    fetch(`https://api.deepgram.com/v1/projects/${projectId}/requests?limit=50`, { headers }),
    fetch('https://api.deepgram.com/v1/models', { headers }),
  ]);

  const balances = balanceRes.ok ? await balanceRes.json() : null;
  const usage = usageRes.ok ? await usageRes.json() : null;
  const apiKeys = keysRes.ok ? await keysRes.json() : null;
  const requests = reqsRes.ok ? await reqsRes.json() : null;
  const models = modelsRes.ok ? await modelsRes.json() : null;

  return {
    project: primaryProject,
    allProjects: projects,
    balances,
    usage,
    apiKeys: apiKeys?.api_keys || [],
    requests: requests?.requests || [],
    models: models?.stt || models?.models || [],
    allModelsRaw: models,
  };
}

export interface AuraVoice {
  name: string;
  canonical_name: string;
  languages: string[];
  [key: string]: any;
}

/**
 * Fetch the current catalog of Deepgram Aura (Speak/TTS) voices, keyed by their
 * `canonical_name` (the value to pass as `model=` to /v1/speak) and the languages
 * each voice supports. Used instead of hardcoding voice names, since the catalog
 * changes over time.
 */
export async function listAuraVoices(): Promise<AuraVoice[]> {
  const res = await fetch('https://api.deepgram.com/v1/models', {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Error al obtener modelos de Deepgram (${res.status})`);
  }
  const data = await res.json();
  return data.tts || [];
}

/**
 * Thrown when Deepgram Speak rejects a request because the text exceeds its
 * per-request character limit, so callers can split the text and retry.
 */
export class DeepgramTextTooLongError extends Error {}

/**
 * Synthesize speech for `text` using an Aura voice, requesting raw linear16 WAV
 * output so the exact PCM sample count/duration can be read directly from the
 * response without decoding a compressed format.
 */
export async function synthesizeSpeechWav(
  text: string,
  voiceModel: string,
  sampleRate: number = 24000
): Promise<Buffer> {
  const params = new URLSearchParams({
    model: voiceModel,
    encoding: 'linear16',
    container: 'wav',
    sample_rate: String(sampleRate),
  });

  const res = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    if ((res.status === 400 || res.status === 413) && /character/i.test(errorText)) {
      throw new DeepgramTextTooLongError(errorText);
    }
    throw new Error(`Deepgram Speak error (${res.status}): ${errorText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
