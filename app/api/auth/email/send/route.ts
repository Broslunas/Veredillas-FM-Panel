import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { sendMagicLinkEmail } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-veredillas-panel';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Dirección de correo no válida' }, { status: 400 });
    }

    const { origin } = new URL(request.url);
    const magicToken = jwt.sign({ email: email.toLowerCase().trim() }, JWT_SECRET, {
      expiresIn: '30m',
    });

    const verifyUrl = `${origin}/api/auth/email/verify?token=${magicToken}`;
    await sendMagicLinkEmail(email, verifyUrl);

    return NextResponse.json({
      success: true,
      message: 'Enlace mágico enviado a tu correo electrónico',
    });
  } catch (error: any) {
    console.error('Error sending magic link:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud de enlace mágico' },
      { status: 500 }
    );
  }
}
