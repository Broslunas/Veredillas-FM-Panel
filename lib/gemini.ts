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

export interface GenerateEpisodeInput {
  topic: string;
  participants?: string;
  notes?: string;
  tags?: string;
}

export interface GeneratedEpisodeContent {
  title: string;
  slug: string;
  description: string;
  tags: string[];
  body: string;
  sections: { title: string; time: string }[];
  quiz: { question: string; options: string[]; correctAnswer: number }[];
}

const EPISODE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    body: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
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
  required: ['title', 'description', 'tags', 'body', 'sections', 'quiz'],
};

export async function generateEpisodeContent(input: GenerateEpisodeInput): Promise<GeneratedEpisodeContent> {
  const prompt = `Eres el redactor jefe de contenidos de Veredillas FM, una radio online en español dirigida a un público joven.
Genera las notas de programa (show notes) completas para un nuevo episodio del podcast.

Tema del episodio: ${input.topic}
${input.participants ? `Participantes: ${input.participants}` : ''}
${input.notes ? `Notas / contexto adicional (puede incluir fragmentos de transcripción): ${input.notes}` : ''}
${input.tags ? `Etiquetas ya usadas en el sitio a tener en cuenta si encajan: ${input.tags}` : ''}

Devuelve estrictamente estos campos:
- title: un título atractivo para el episodio (máximo 70 caracteres).
- description: un resumen corto (máximo 160 caracteres).
- tags: entre 2 y 5 etiquetas relevantes en español.
- body: notas de programa en HTML simple (<p>, <h2>, <ul>/<li>, <strong>) con contexto, temas tratados y momentos destacados.
- sections: entre 3 y 6 capítulos/segmentos del episodio en orden cronológico (solo el título de cada capítulo; no inventes marcas de tiempo).
- quiz: 3 preguntas tipo test sobre el contenido del episodio, cada una con 4 opciones y el índice (0-3, empezando en 0) de la respuesta correcta.

Responde únicamente con el JSON solicitado, en español.`;

  const text = await callGemini(prompt, { responseSchema: EPISODE_SCHEMA });
  const parsed = JSON.parse(text);

  const title = parsed.title || '';
  return {
    title,
    slug: slugify(title),
    description: parsed.description || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean) : [],
    body: parsed.body || '',
    sections: Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((s: any) => s && s.title)
          .map((s: any) => ({ title: s.title, time: '00:00' }))
      : [],
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
