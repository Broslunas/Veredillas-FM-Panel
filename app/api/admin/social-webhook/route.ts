import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function POST(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const N8N_WEBHOOK_URL = 'https://n8n.broslunas.com/webhook/clips-upload-vfm';
    const WEBHOOK_SECRET = process.env.CONTACT_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || 'secret';

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de n8n:', errorText);
      return NextResponse.json({ error: 'El flujo n8n respondió con error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Internal server error in social-webhook:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
