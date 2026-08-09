import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(
      `<html><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:40px;text-align:center;">
        <h1 style="color:#ef4444;">Error de Autorización</h1>
        <p>${error || 'No se recibió código de autorización de Google.'}</p>
        <a href="/youtube" style="color:#818cf8;text-decoration:none;">← Volver al Panel</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = `${url.origin}/api/youtube/auth/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'No se devolvió Refresh Token. Asegúrate de forzar la pantalla de consentimiento.';
      return new Response(
        `<html><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#ef4444;">No se obtuvo el Refresh Token</h1>
          <p>${errMsg}</p>
          <a href="/youtube" style="color:#818cf8;text-decoration:none;">← Volver al Panel</a>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const refreshToken = tokenData.refresh_token;

    return new Response(
      `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Canal Conectado - Veredillas FM</title>
        <style>
          body { background: #09090b; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; max-width: 550px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
          h1 { font-size: 22px; color: #4ade80; margin-top: 0; margin-bottom: 12px; }
          p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
          .token-box { background: #09090b; border: 1px solid #3f3f46; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #e4e4e7; word-break: break-all; margin-bottom: 20px; text-align: left; position: relative; }
          .btn { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; font-size: 14px; }
          .btn:hover { background: #4338ca; }
          .btn-secondary { background: #27272a; color: #e4e4e7; margin-left: 10px; }
          .btn-secondary:hover { background: #3f3f46; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>¡Canal de YouTube Vinculado con Éxito! 🎉</h1>
          <p>Copia el siguiente <strong>YOUTUBE_REFRESH_TOKEN</strong> y añádelo a tu archivo <code>.env.local</code>:</p>
          <div class="token-box" id="tokenBox">${refreshToken}</div>
          <div>
            <button class="btn" onclick="copyToken()">📋 Copiar Token</button>
            <a href="/youtube" class="btn btn-secondary">Ir a YouTube Studio Panel →</a>
          </div>
        </div>
        <script>
          function copyToken() {
            const token = document.getElementById('tokenBox').innerText;
            navigator.clipboard.writeText(token).then(() => {
              alert('¡Refresh Token copiado al portapapeles!');
            });
          }
        </script>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    return new Response(
      `<html><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:40px;text-align:center;">
        <h1 style="color:#ef4444;">Error en Servidor</h1>
        <p>${err.message}</p>
        <a href="/youtube" style="color:#818cf8;text-decoration:none;">← Volver al Panel</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
