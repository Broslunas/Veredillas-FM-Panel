import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { generateEpisodeContent } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.topic || !String(body.topic).trim()) {
      return NextResponse.json({ error: 'Se requiere un tema para generar el episodio' }, { status: 400 });
    }

    const generated = await generateEpisodeContent({
      topic: body.topic,
      participants: body.participants,
      notes: body.notes,
      tags: body.tags,
    });

    return NextResponse.json({ success: true, ...generated });
  } catch (error: any) {
    console.error('Error in /api/admin/gemini/generate-episode:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar el episodio con IA' },
      { status: 500 }
    );
  }
}
