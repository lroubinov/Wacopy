import { requestIsAdmin } from '../../auth/session';
import { createRoom, deleteRoom, listRooms } from '../../../lib/database';

async function authorized(request: Request) {
  return requestIsAdmin(request);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  return Response.json({ rooms: listRooms() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let body: { name?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80) {
    return Response.json({ error: 'Room name must contain 2-80 characters' }, { status: 400 });
  }
  return Response.json({ room: createRoom(body.name) });
}

export async function DELETE(request: Request) {
  if (!(await authorized(request))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let body: { roomId?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.roomId !== 'string') return Response.json({ error: 'Room is required' }, { status: 400 });
  const deleted = deleteRoom(body.roomId);
  return Response.json({ deleted }, { status: deleted ? 200 : 404 });
}
