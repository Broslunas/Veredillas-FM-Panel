/**
 * Gemini API Helper Utilities for Veredillas FM Panel
 * Generación de contenido (blog / episodios) asistida por IA.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiGenerationOptions {
  temperature?: number;
  responseSchema?: Record<string, any>;
}

async function callGemini(prompt: string, options: GeminiGenerationOptions = {}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Falta configurar GEMINI_API_KEY en las variables de entorno');
  }

  const generationConfig: Record<string, any> = {
    temperature: options.temperature ?? 0.9,
  };

  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini bloqueó la generación (${blockReason}). Prueba a reformular el tema.`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text || '').join('');

  if (!text) {
    throw new Error('Gemini no ha devuelto contenido para esta petición.');
  }

  return text;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface GenerateBlogInput {
  topic: string;
  notes?: string;
  tone?: string;
  tags?: string;
}

export interface GeneratedBlogContent {
  title: string;
  slug: string;
  description: string;
  tags: string[];
  body: string;
}

const BLOG_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    body: { type: 'string' },
  },
  required: ['title', 'description', 'tags', 'body'],
};

export async function generateBlogContent(input: GenerateBlogInput): Promise<GeneratedBlogContent> {
  const prompt = `Eres el redactor jefe del blog de Veredillas FM, una radio online en español dirigida a un público joven.
Escribe un artículo de blog completo, ameno y bien estructurado sobre el siguiente tema.

Tema: ${input.topic}
${input.notes ? `Notas / contexto adicional: ${input.notes}` : ''}
${input.tone ? `Tono deseado: ${input.tone}` : 'Tono deseado: cercano, informal y entusiasta, propio de una radio joven.'}
${input.tags ? `Etiquetas ya usadas en el sitio a tener en cuenta si encajan: ${input.tags}` : ''}

Devuelve estrictamente estos campos:
- title: un título atractivo (máximo 70 caracteres).
- description: un resumen corto (máximo 160 caracteres) para la tarjeta del blog.
- tags: entre 2 y 5 etiquetas relevantes en español.
- body: el cuerpo completo del artículo en HTML simple (usa <p>, <h2>, <h3>, <ul>/<li>, <strong>), con al menos 4-6 párrafos bien desarrollados.

Responde únicamente con el JSON solicitado, en español.`;

  const text = await callGemini(prompt, { responseSchema: BLOG_SCHEMA });
  const parsed = JSON.parse(text);

  const title = parsed.title || '';
  return {
    title,
    slug: slugify(title),
    description: parsed.description || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean) : [],
    body: parsed.body || '',
  };
}

export interface GenerateQuizInput {
  title?: string;
  transcription: { time: string; text: string; speaker?: string }[];
  sections?: { title: string; time: string }[];
}

export interface GeneratedQuizContent {
  quiz: { question: string; options: string[]; correctAnswer: number }[];
}

const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    quiz: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswer: { type: 'integer' },
        },
        required: ['question', 'options', 'correctAnswer'],
      },
    },
  },
  required: ['quiz'],
};

// Keeps the prompt within a safe token budget for very long episodes.
const MAX_TRANSCRIPT_CHARS = 24000;

export async function generateQuizFromTranscript(input: GenerateQuizInput): Promise<GeneratedQuizContent> {
  const transcriptText = input.transcription
    .filter((t) => t && t.text && t.text.trim())
    .map((t) => `[${t.time}]${t.speaker ? ` ${t.speaker}:` : ''} ${t.text.trim()}`)
    .join('\n')
    .slice(0, MAX_TRANSCRIPT_CHARS);

  if (!transcriptText) {
    throw new Error('El episodio no tiene transcripción para analizar.');
  }

  const chaptersText =
    Array.isArray(input.sections) && input.sections.length
      ? input.sections.map((s) => `[${s.time}] ${s.title}`).join('\n')
      : 'No hay capítulos definidos.';

  const prompt = `Eres el editor de contenido de Veredillas FM, una radio online en español dirigida a un público joven.
Analiza la transcripción con marcas de tiempo y los capítulos de este episodio${input.title ? ` titulado "${input.title}"` : ''} para proponer un quiz.

Capítulos:
${chaptersText}

Transcripción (con marcas de tiempo [mm:ss]):
${transcriptText}

Devuelve estrictamente este campo:
- quiz: 5 preguntas tipo test sobre el contenido real de la transcripción, cada una con 4 opciones y el índice (0-3, empezando en 0) de la respuesta correcta.

Basa las preguntas únicamente en el contenido real de la transcripción y los capítulos proporcionados, no inventes información. Responde únicamente con el JSON solicitado, en español.`;

  const text = await callGemini(prompt, { responseSchema: QUIZ_SCHEMA, temperature: 0.7 });
  const parsed = JSON.parse(text);

  return {
    quiz: Array.isArray(parsed.quiz)
      ? parsed.quiz
          .filter((q: any) => q && q.question)
          .map((q: any) => ({
            question: q.question,
            options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', ''],
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
          }))
      : [],
  };
}

// Per-field episode content generation: each field is generated independently
// from whatever other fields are already filled in, instead of a single
// "generate everything from a topic" flow.
export type EpisodeFieldName =
  | 'title'
  | 'description'
  | 'tags'
  | 'participants'
  | 'warningMessage'
  | 'body'
  | 'sections';

export interface EpisodeFieldContext {
  title?: string;
  description?: string;
  tags?: string;
  participants?: string;
  body?: string;
  warningMessage?: string;
  transcription?: { time: string; text: string; speaker?: string }[];
  sections?: { title: string; time: string }[];
}

export type GeneratedFieldValue = string | string[] | { title: string; time: string }[];

const FIELD_TEXT_SCHEMA = {
  type: 'object',
  properties: { value: { type: 'string' } },
  required: ['value'],
};

const FIELD_STRING_ARRAY_SCHEMA = {
  type: 'object',
  properties: { value: { type: 'array', items: { type: 'string' } } },
  required: ['value'],
};

const FIELD_SECTIONS_SCHEMA = {
  type: 'object',
  properties: {
    value: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          time: { type: 'string' },
        },
        required: ['title', 'time'],
      },
    },
  },
  required: ['value'],
};

function buildTranscriptBlock(transcription?: { time: string; text: string; speaker?: string }[]): string {
  if (!Array.isArray(transcription)) return '';
  return transcription
    .filter((t) => t && t.text && t.text.trim())
    .map((t) => `[${t.time}]${t.speaker ? ` ${t.speaker}:` : ''} ${t.text.trim()}`)
    .join('\n')
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

function buildContextBlock(context: EpisodeFieldContext, opts: { includeTranscript?: boolean } = {}): string {
  const lines: string[] = [];
  if (context.title?.trim()) lines.push(`Título actual: ${context.title.trim()}`);
  if (context.description?.trim()) lines.push(`Descripción actual: ${context.description.trim()}`);
  if (context.tags?.trim()) lines.push(`Etiquetas actuales: ${context.tags.trim()}`);
  if (context.participants?.trim()) lines.push(`Participantes actuales: ${context.participants.trim()}`);
  if (context.warningMessage?.trim()) lines.push(`Aviso de contenido sensible actual: ${context.warningMessage.trim()}`);
  if (context.body?.trim()) lines.push(`Notas del programa actuales:\n${context.body.trim()}`);
  if (Array.isArray(context.sections) && context.sections.length) {
    lines.push(`Capítulos actuales:\n${context.sections.map((s) => `[${s.time}] ${s.title}`).join('\n')}`);
  }
  if (opts.includeTranscript) {
    const transcriptText = buildTranscriptBlock(context.transcription);
    if (transcriptText) lines.push(`Transcripción (con marcas de tiempo):\n${transcriptText}`);
  }
  return lines.join('\n\n');
}

export async function generateEpisodeField(
  field: EpisodeFieldName,
  context: EpisodeFieldContext
): Promise<GeneratedFieldValue> {
  const intro =
    'Eres el redactor jefe de contenidos de Veredillas FM, una radio online en español dirigida a un público joven.';

  switch (field) {
    case 'title': {
      const contextBlock = buildContextBlock(context, { includeTranscript: true });
      if (!contextBlock) throw new Error('No hay suficiente información para generar el título.');
      const prompt = `${intro}
Con la siguiente información de un episodio de podcast, escribe un título atractivo (máximo 70 caracteres), en español.

${contextBlock}

Responde únicamente con el JSON solicitado: {"value": "..."}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_TEXT_SCHEMA });
      return (JSON.parse(text).value || '').toString();
    }

    case 'description': {
      const contextBlock = buildContextBlock(context, { includeTranscript: true });
      if (!contextBlock) throw new Error('No hay suficiente información para generar la descripción.');
      const prompt = `${intro}
Con la siguiente información de un episodio de podcast, escribe una descripción corta y atractiva (máximo 160 caracteres), en español.

${contextBlock}

Responde únicamente con el JSON solicitado: {"value": "..."}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_TEXT_SCHEMA });
      return (JSON.parse(text).value || '').toString();
    }

    case 'tags': {
      const contextBlock = buildContextBlock(context, { includeTranscript: true });
      if (!contextBlock) throw new Error('No hay suficiente información para generar las etiquetas.');
      const prompt = `${intro}
Con la siguiente información de un episodio de podcast, propone entre 2 y 5 etiquetas temáticas relevantes en español (palabras o expresiones cortas y específicas al contenido, nunca la etiqueta genérica "General").

${contextBlock}

Responde únicamente con el JSON solicitado: {"value": ["etiqueta1", "etiqueta2", ...]}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_STRING_ARRAY_SCHEMA });
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.value) ? parsed.value.filter(Boolean).map(String) : [];
    }

    case 'participants': {
      const transcriptText = buildTranscriptBlock(context.transcription);
      if (!transcriptText) throw new Error('Se requiere la transcripción del episodio para generar los participantes.');
      const prompt = `${intro}
A partir de la siguiente transcripción con hablantes identificados, extrae la lista de nombres reales de las personas que participan en el episodio (ignora etiquetas genéricas sin identificar, como "Hablante 1").

Transcripción:
${transcriptText}

Responde únicamente con el JSON solicitado: {"value": ["Nombre 1", "Nombre 2", ...]}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_STRING_ARRAY_SCHEMA, temperature: 0.3 });
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.value) ? parsed.value.filter(Boolean).map(String) : [];
    }

    case 'warningMessage': {
      const contextBlock = buildContextBlock(context, { includeTranscript: true });
      if (!contextBlock) throw new Error('No hay suficiente información para analizar si el episodio necesita un aviso.');
      const prompt = `${intro}
Analiza la siguiente información de un episodio de podcast y determina si contiene lenguaje explícito o temas sensibles (violencia, sexo, salud mental, drogas, etc.) que merezcan un aviso de contenido para los oyentes.

${contextBlock}

Si el episodio necesita un aviso, devuelve una frase corta y clara en español avisando del contenido sensible. Si no lo necesita, devuelve un string vacío "".

Responde únicamente con el JSON solicitado: {"value": "..."}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_TEXT_SCHEMA, temperature: 0.4 });
      return (JSON.parse(text).value || '').toString();
    }

    case 'body': {
      const contextBlock = buildContextBlock(context, { includeTranscript: true });
      if (!contextBlock) throw new Error('No hay suficiente información para generar las notas del programa.');
      const prompt = `${intro}
Con la siguiente información de un episodio de podcast, redacta las notas de programa (show notes) completas en HTML simple (usa <p>, <h2>, <ul>/<li>, <strong>), con contexto, temas tratados y momentos destacados.

${contextBlock}

Responde únicamente con el JSON solicitado: {"value": "<p>...</p>..."}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_TEXT_SCHEMA });
      return (JSON.parse(text).value || '').toString();
    }

    case 'sections': {
      const transcriptText = buildTranscriptBlock(context.transcription);
      if (!transcriptText) throw new Error('Se requiere la transcripción del episodio para generar los capítulos.');
      const prompt = `${intro}
Analiza la siguiente transcripción con marcas de tiempo [mm:ss] de un episodio de podcast y divídela en capítulos/secciones cronológicos.

Transcripción:
${transcriptText}

Devuelve entre 3 y 8 capítulos. Para cada uno indica:
- title: un título corto y descriptivo del segmento.
- time: la marca de tiempo de inicio del capítulo, EXACTAMENTE en el mismo formato que aparece entre corchetes en la transcripción (mm:ss o h:mm:ss), tomada de una de las marcas de tiempo reales de la transcripción. No inventes tiempos que no existan en la transcripción.

Responde únicamente con el JSON solicitado: {"value": [{"title": "...", "time": "mm:ss"}, ...]}`;
      const text = await callGemini(prompt, { responseSchema: FIELD_SECTIONS_SCHEMA, temperature: 0.5 });
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.value)
        ? parsed.value
            .filter((s: any) => s && s.title && s.time)
            .map((s: any) => ({ title: String(s.title), time: String(s.time) }))
        : [];
    }

    default:
      throw new Error('Campo no soportado para generación con IA.');
  }
}
