import { createRoom, listRoomsForUser } from '../../../lib/database';
import { getSession } from '../../auth/session';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session || session.role !== 'user') return Response.json({ error: 'User required' }, { status: 401 });
  return Response.json({ rooms: listRoomsForUser(session.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || session.role !== 'user') return Response.json({ error: 'User required' }, { status: 401 });
  let body: { name?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80) return Response.json({ error: 'Invalid room name' }, { status: 400 });
  return Response.json({ room: createRoom(body.name, session.userId) });
}
