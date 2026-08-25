import { acknowledgeBrowserMessage, latestForBrowser, roomBelongsToUser, roomExists } from '../../../lib/database';
import { authenticationEnabled, getSession } from '../../auth/session';

async function ownedRoom(request: Request) {
  const session = await getSession(request);
  const roomId = new URL(request.url).searchParams.get('roomId') ?? '';
  if (!roomId) return null;
  if (!authenticationEnabled()) return roomExists(roomId) ? roomId : null;
  if (!session) return null;
  if (session.role === 'admin') return roomExists(roomId) ? roomId : null;
  if (!roomBelongsToUser(roomId, session.userId)) return null;
  return roomId;
}

export async function GET(request: Request) {
  const roomId = await ownedRoom(request);
  if (!roomId) return Response.json({ error: 'Room not found' }, { status: 404 });
  return Response.json(latestForBrowser(roomId) ?? { id: null, text: '', updatedAt: null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const roomId = await ownedRoom(request);
  if (!roomId) return Response.json({ error: 'Room not found' }, { status: 404 });
  let body: { messageId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.messageId !== 'string') return Response.json({ error: 'Message required' }, { status: 400 });
  return Response.json({ cleared: acknowledgeBrowserMessage(roomId, body.messageId) });
}
