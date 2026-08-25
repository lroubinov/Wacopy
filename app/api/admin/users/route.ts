import { createUser, listUsers, revokeUser, updateUserPassword } from '../../../lib/database';
import { createPasswordSalt, hashPassword } from '../../../lib/tokens';
import { requestIsAdmin } from '../../auth/session';

export async function GET(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  return Response.json({ users: listUsers() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  let body: { username?: unknown; displayName?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.username !== 'string' || !/^[a-zA-Z0-9._-]{3,40}$/.test(body.username) || typeof body.displayName !== 'string' || body.displayName.trim().length < 2 || body.displayName.length > 80 || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return Response.json({ error: 'Invalid user details' }, { status: 400 });
  }
  const salt = createPasswordSalt();
  try {
    const user = createUser(body.username, body.displayName, salt, await hashPassword(body.password, salt));
    return Response.json({ user });
  } catch {
    return Response.json({ error: 'Username already exists' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  let body: { userId?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.userId !== 'string' || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return Response.json({ error: 'Password must contain 8-128 characters' }, { status: 400 });
  }
  const salt = createPasswordSalt();
  const updated = updateUserPassword(body.userId, salt, await hashPassword(body.password, salt));
  return Response.json({ updated }, { status: updated ? 200 : 404 });
}

export async function DELETE(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Admin required' }, { status: 401 });
  let body: { userId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.userId !== 'string') return Response.json({ error: 'User is required' }, { status: 400 });
  return Response.json({ revoked: revokeUser(body.userId) });
}
