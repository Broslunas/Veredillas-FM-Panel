import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { transcribeMedia, convertToSRT, convertToVTT, segmentIntoShortSubtitles } from '@/lib/deepgram';

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const contentTypeHeader = request.headers.get('content-type') || '';

    let source: Buffer | string;
    let mimeType = 'audio/mp3';
    let options: any = {};

    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json();
      if (!body.url) {
        return NextResponse.json({ error: 'Se requiere la URL del archivo de vídeo/audio' }, { status: 400 });
      }
      source = body.url;
      options = {
        model: body.model || 'nova-3',
        language: body.language || 'es',
        smartFormat: body.smartFormat ?? true,
        diarize: body.diarize ?? true,
        punctuate: body.punctuate ?? true,
      };
    } else {
      // Form Data upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const model = (formData.get('model') as string) || 'nova-3';
      const language = (formData.get('language') as string) || 'es';

      if (!file) {
        return NextResponse.json({ error: 'Archivo no proporcionado en el formulario' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      source = Buffer.from(arrayBuffer);
      mimeType = file.type || 'audio/mp3';
      options = { model, language, smartFormat: true, diarize: true, punctuate: true };
    }

    const result = await transcribeMedia(source, options, mimeType);
    const srt = convertToSRT(result);
    const vtt = convertToVTT(result);
    const shortSegments = segmentIntoShortSubtitles(result);

    const alternative = result.results?.channels?.[0]?.alternatives?.[0];

    return NextResponse.json({
      success: true,
      transcript: alternative?.transcript || '',
      confidence: alternative?.confidence || 0,
      srt,
      vtt,
      duration: result.metadata?.duration || 0,
      utterances: shortSegments.map((s) => ({
        start: s.start,
        end: s.end,
        transcript: s.text,
        speaker: s.speaker,
      })),
      raw: result,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/deepgram/transcribe:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar transcripción en Deepgram' },
      { status: 500 }
    );
  }
}
