import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
  if (!spotifyClientId) {
    return NextResponse.json({ error: 'Spotify Client ID not configured' }, { status: 500 });
  }

  const { origin } = new URL(request.url);
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/auth/spotify/callback`;

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('client_id', spotifyClientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'user-read-private user-read-email');
  authUrl.searchParams.set('show_dialog', 'true');

  return NextResponse.redirect(authUrl.toString());
}
