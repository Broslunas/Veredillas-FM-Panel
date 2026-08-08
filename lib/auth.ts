import jwt from 'jsonwebtoken';
import { IUser } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-veredillas-panel';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'owner';
}

export function generateToken(user: IUser): string {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) acc[name] = decodeURIComponent(rest.join('='));
    return acc;
  }, {} as Record<string, string>);
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Google OAuth token exchange failed:', errText);
    throw new Error('Failed to exchange Google code for token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  return await response.json();
}

export async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID || ''}:${process.env.SPOTIFY_CLIENT_SECRET || ''}`
  ).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Spotify token exchange error:', errText);
    throw new Error('Failed to exchange Spotify code');
  }

  return await response.json();
}

export async function getSpotifyUserInfo(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Spotify user info');
  }

  return await response.json();
}

export async function sendMagicLinkEmail(email: string, verifyUrl: string) {
  const apiKeyPublic = process.env.MJ_APIKEY_PUBLIC;
  const apiKeyPrivate = process.env.MJ_API_SECRET;

  if (!apiKeyPublic || !apiKeyPrivate) {
    console.warn('Mailjet API keys not fully configured. Simulating magic link email dispatch.');
    console.log(`[MAGIC LINK DEMO] Link for ${email}: ${verifyUrl}`);
    return { success: true, simulated: true };
  }

  const authHeader = 'Basic ' + Buffer.from(`${apiKeyPublic}:${apiKeyPrivate}`).toString('base64');

  const payload = {
    Messages: [
      {
        From: {
          Email: 'contacto@broslunas.com',
          Name: 'Veredillas FM Panel',
        },
        To: [
          {
            Email: email,
            Name: email.split('@')[0],
          },
        ],
        Subject: '🔑 Tu enlace de acceso al Panel Veredillas FM',
        HTMLPart: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; padding: 40px 20px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #27272a;">
            <h2 style="color: #ffffff; font-size: 20px; margin-top: 0; margin-bottom: 16px;">Veredillas FM — Panel de Control</h2>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              Haz clic en el siguiente botón para iniciar sesión directamente en el panel de gestión.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                Iniciar Sesión en el Panel
              </a>
            </div>
            <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
              Este enlace expira en 30 minutos. Si no solicitaste este acceso, puedes ignorar este correo.
            </p>
          </div>
        `,
      },
    ],
  };

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Mailjet API error:', errText);
    throw new Error('No se pudo enviar el correo de acceso');
  }

  return { success: true };
}
