import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { exchangeSpotifyCode, getSpotifyUserInfo, generateToken } from '@/lib/auth';
import User from '@/models/User';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/login?error=spotify_failed`);
  }

  try {
    await dbConnect();
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/auth/spotify/callback`;
    const tokenData = await exchangeSpotifyCode(code, redirectUri);
    const spotifyUser = await getSpotifyUserInfo(tokenData.access_token);

    const email = spotifyUser.email;
    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=spotify_email_required`);
    }

    let user = await User.findOne({
      $or: [{ spotifyId: spotifyUser.id }, { email }],
    });

    const now = new Date();

    if (!user) {
      user = await User.create({
        spotifyId: spotifyUser.id,
        email,
        name: spotifyUser.display_name || email.split('@')[0],
        picture: spotifyUser.images?.[0]?.url,
        role: 'user',
        lastLogin: now,
        lastActiveAt: now,
      });
    } else {
      if (!user.spotifyId) user.spotifyId = spotifyUser.id;
      user.lastLogin = now;
      user.lastActiveAt = now;
      if (spotifyUser.images?.[0]?.url && !user.picture) {
        user.picture = spotifyUser.images[0].url;
      }
      await user.save();
    }

    const token = generateToken(user);
    const response = NextResponse.redirect(
      user.role === 'admin' || user.role === 'owner' ? `${origin}/` : `${origin}/unauthorized`
    );

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Spotify OAuth error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }
}
