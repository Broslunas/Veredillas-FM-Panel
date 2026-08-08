import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function POST(request: Request) {
  try {
    const { authorized, user } = await isAuthorizedAdmin(request);
    if (!authorized || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, docType, docUrl } = body;

    if (!name || !email || !docType || !docUrl) {
      return NextResponse.json({ error: 'Faltan datos (nombre, email, tipo o url)' }, { status: 400 });
    }

    const webhookUrl = 'https://n8n.broslunas.com/webhook/veredillasfm-autorizations';
    const secret = process.env.CONTACT_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || 'secret';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        recipientName: name,
        recipientEmail: email,
        authorizationType: docType,
        documentUrl: docUrl,
        adminUser: user.email,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'Autorización enviada correctamente' });
    } else {
      console.error('Webhook error:', response.status, await response.text());
      return NextResponse.json({ error: 'Error al enviar la autorización al servicio de correo' }, { status: 500 });
    }
  } catch (error) {
    console.error('Server error sending authorization:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
