import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { exchangeGoogleCode, getGoogleUserInfo, generateToken } from '@/lib/auth';
import User from '@/models/User';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }

  try {
    await dbConnect();

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
    const accessToken = await exchangeGoogleCode(code, redirectUri);
    const googleUser = await getGoogleUserInfo(accessToken);

    let user = await User.findOne({
      $or: [{ googleId: googleUser.id }, { email: googleUser.email }],
    });

    const now = new Date();

    if (!user) {
      user = await User.create({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        role: 'user', // Default role; owner/admin must assign admin/owner or set first user
        lastLogin: now,
        lastActiveAt: now,
      });
    } else {
      if (!user.googleId) user.googleId = googleUser.id;
      user.lastLogin = now;
      user.lastActiveAt = now;
      if (googleUser.picture && !user.picture) user.picture = googleUser.picture;
      await user.save();
    }

    // Role check: if not admin or owner, redirect to unauthorized
    const token = generateToken(user);
    const response = NextResponse.redirect(
      user.role === 'admin' || user.role === 'owner' || user.role === 'editor' ? `${origin}/` : `${origin}/unauthorized`
    );

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }
}
