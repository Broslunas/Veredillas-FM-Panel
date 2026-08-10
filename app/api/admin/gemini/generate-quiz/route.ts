import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { generateQuizFromTranscript } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    if (!Array.isArray(body.transcription) || !body.transcription.some((t: any) => t?.text?.trim())) {
      return NextResponse.json(
        { error: 'Se requiere la transcripción del episodio para generar el quiz' },
        { status: 400 }
      );
    }

    const generated = await generateQuizFromTranscript({
      title: body.title,
      transcription: body.transcription,
      sections: body.sections,
    });

    return NextResponse.json({ success: true, ...generated });
  } catch (error: any) {
    console.error('Error in /api/admin/gemini/generate-quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar el quiz con IA' },
      { status: 500 }
    );
  }
}
