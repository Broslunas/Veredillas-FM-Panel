import { parseCookies, verifyToken, JWTPayload } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import {
  PermissionLevel,
  PermissionMap,
  PermissionSection,
  can,
  resolvePermissions,
  sectionForRequest,
} from '@/lib/permissions';

export interface AuthUser extends JWTPayload {
  permissions: PermissionMap;
}

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
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
    permissions: resolvePermissions(dbUser.role, dbUser.permissions),
  };
}

export async function isAuthorizedAdmin(request: Request): Promise<{ authorized: boolean; user?: AuthUser }> {
  const user = await getAuthUser(request);
  if (!user) return { authorized: false };
  if (user.role === 'admin' || user.role === 'owner' || user.role === 'editor') {
    return { authorized: true, user };
  }
  return { authorized: false, user };
}

export async function isAuthorizedOwnerOrAdmin(request: Request): Promise<{ authorized: boolean; user?: AuthUser }> {
  const user = await getAuthUser(request);
  if (!user) return { authorized: false };
  if (user.role === 'admin' || user.role === 'owner') {
    return { authorized: true, user };
  }
  return { authorized: false, user };
}

/**
 * Authorizes against an explicit section. Panel access (editor and above) is
 * still required — permissions grant reach *within* the panel, never entry to it.
 */
export async function isAuthorizedFor(
  request: Request,
  section: PermissionSection,
  level: PermissionLevel = 'write'
): Promise<{ authorized: boolean; user?: AuthUser }> {
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) return { authorized: false, user };
  if (!can(user.permissions, section, level)) return { authorized: false, user };
  return { authorized: true, user };
}

/**
 * Derives the required section and level from the request URL and method
 * (see `ROUTE_SECTIONS` in lib/permissions.ts). Routes with no mapping only
 * require panel access, which is what they required before.
 */
export async function isAuthorizedRoute(request: Request): Promise<{ authorized: boolean; user?: AuthUser }> {
  const { pathname } = new URL(request.url);
  const { section, level } = sectionForRequest(pathname, request.method);
  if (!section) return isAuthorizedAdmin(request);
  return isAuthorizedFor(request, section, level);
}
