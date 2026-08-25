import { findUserByUsername } from '../../lib/database';
import { hashPassword } from '../../lib/tokens';
import { clearSessionCookie, createSessionCookie, passwordMatches, type Session } from './session';

type Attempt = { failures: number; blockedUntil: number };
const globalAttempts = globalThis as typeof globalThis & { loginAttempts?: Map<string, Attempt> };
const attempts = globalAttempts.loginAttempts ??= new Map<string, Attempt>();

function clientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const current = attempts.get(key);
  if (current && current.blockedUntil > Date.now()) return Response.json({ error: 'Too many attempts' }, { status: 429 });

  let body: { username?: unknown; password?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  let session: Session | null = null;
  if (typeof body.password === 'string' && typeof body.username === 'string' && body.username.trim()) {
    const user = findUserByUsername(body.username);
    if (user && (await hashPassword(body.password, user.passwordSalt)) === user.passwordHash) session = { role: 'user', userId: user.id };
  } else if (typeof body.password === 'string' && await passwordMatches(body.password)) {
    session = { role: 'admin' };
  }

  if (!session) {
    const failures = (current?.failures ?? 0) + 1;
    attempts.set(key, { failures: failures >= 5 ? 0 : failures, blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    return Response.json({ error: 'Wrong credentials' }, { status: 401 });
  }

  attempts.delete(key);
  return Response.json({ role: session.role }, { headers: { 'Set-Cookie': await createSessionCookie(request, session), 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } });
}
