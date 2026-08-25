import { findActiveUserById } from '../../../lib/database';
import { getSession } from '../../auth/session';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (session.role === 'admin') return Response.json({ role: 'admin' });
  const user = findActiveUserById(session.userId);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  return Response.json({ role: 'user', user: { id: user.id, username: user.username, displayName: user.displayName } });
}
