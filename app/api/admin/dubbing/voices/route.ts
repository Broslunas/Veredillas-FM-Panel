import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import { listAuraVoices } from '@/lib/deepgram';

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedRoute(request);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const voices = await listAuraVoices();
    // Dedupe to base language codes (voices often expose locale variants like
    // "en-US"/"en-GB"/"en-AU" — the picker only needs one "Inglés" entry, matching by
    // base code is already how filterVoicesForLanguage/mapSpeakersToVoices work).
    const languages = Array.from(
      new Set(voices.flatMap((v) => v.languages || []).map((l) => l.split('-')[0]))
    ).sort();
    return NextResponse.json({ voices, languages });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener las voces de Deepgram' },
      { status: 500 }
    );
  }
}
