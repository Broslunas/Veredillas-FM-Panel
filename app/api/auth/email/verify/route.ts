import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-veredillas-panel';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    if (!decoded || !decoded.email) {
      return NextResponse.redirect(`${origin}/login?error=invalid_token`);
    }

    await dbConnect();
    const email = decoded.email.toLowerCase().trim();
    const now = new Date();

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name: email.split('@')[0],
        role: 'user',
        lastLogin: now,
        lastActiveAt: now,
      });
    } else {
      user.lastLogin = now;
      user.lastActiveAt = now;
      await user.save();
    }

    const sessionToken = generateToken(user);
    const response = NextResponse.redirect(
      user.role === 'admin' || user.role === 'owner' || user.role === 'editor' ? `${origin}/` : `${origin}/unauthorized`
    );

    response.cookies.set('auth-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Magic link verification error:', error);
    return NextResponse.redirect(`${origin}/login?error=token_expired`);
  }
}
