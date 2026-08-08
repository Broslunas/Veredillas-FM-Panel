import { parseCookies, verifyToken, JWTPayload } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function getAuthUser(request: Request): Promise<JWTPayload | null> {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies['auth-token'];

  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // Double check DB role
  await dbConnect();
  const dbUser = await User.findById(payload.userId);
  if (!dbUser) return null;

  return {
    userId: dbUser._id.toString(),
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

export async function isAuthorizedAdmin(request: Request): Promise<{ authorized: boolean; user?: JWTPayload }> {
  const user = await getAuthUser(request);
  if (!user) return { authorized: false };
  if (user.role === 'admin' || user.role === 'owner') {
    return { authorized: true, user };
  }
  return { authorized: false, user };
}
