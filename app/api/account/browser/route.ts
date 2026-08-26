import { acknowledgeBrowserMessage, acknowledgeImage, latestForBrowser, latestImageForBrowser, roomBelongsToUser, roomExists } from '../../../lib/database';
import { cleanupImages } from '../../../lib/image-cleanup';
import { deleteImage } from '../../../lib/image-storage';
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
  await cleanupImages();
  const textMessage = latestForBrowser(roomId);
  const imageMessage = latestImageForBrowser(roomId);
  if (imageMessage && (!textMessage || imageMessage.updatedAt > textMessage.updatedAt)) {
    return Response.json({ kind: 'image', id: imageMessage.id, mimeType: imageMessage.mimeType, byteSize: imageMessage.byteSize, imageUrl: `/api/account/browser/image?roomId=${encodeURIComponent(roomId)}&id=${encodeURIComponent(imageMessage.id)}`, updatedAt: imageMessage.updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json(textMessage ? { kind: 'text', ...textMessage } : { kind: null, id: null, text: '', updatedAt: null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const roomId = await ownedRoom(request);
  if (!roomId) return Response.json({ error: 'Room not found' }, { status: 404 });
  let body: { messageId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.messageId !== 'string') return Response.json({ error: 'Message required' }, { status: 400 });
  const textCleared = acknowledgeBrowserMessage(roomId, body.messageId);
  const imageFile = textCleared ? null : acknowledgeImage('browser', roomId, body.messageId);
  if (imageFile) await deleteImage(imageFile);
  return Response.json({ cleared: textCleared || Boolean(imageFile) });
}
