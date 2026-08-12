import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { generateEpisodeField, EpisodeFieldName } from '@/lib/gemini';

const VALID_FIELDS: EpisodeFieldName[] = [
  'title',
  'description',
  'tags',
  'participants',
  'warningMessage',
  'body',
  'sections',
];

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const field = body.field as EpisodeFieldName;
    if (!VALID_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Campo no válido para generación con IA' }, { status: 400 });
    }

    const context = body.context || {};
    const value = await generateEpisodeField(field, {
      title: context.title,
      description: context.description,
      tags: context.tags,
      participants: context.participants,
      body: context.body,
      warningMessage: context.warningMessage,
      transcription: Array.isArray(context.transcription) ? context.transcription : undefined,
      sections: Array.isArray(context.sections) ? context.sections : undefined,
    });

    return NextResponse.json({ success: true, value });
  } catch (error: any) {
    console.error('Error in /api/admin/gemini/generate-episode-field:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar el campo con IA' },
      { status: 500 }
    );
  }
}
