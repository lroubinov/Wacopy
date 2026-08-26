import { imageForBrowser, roomBelongsToUser, roomExists } from '../../../../lib/database';
import { readImage } from '../../../../lib/image-storage';
import { authenticationEnabled, getSession } from '../../../auth/session';

export async function GET(request: Request) {
  const session = await getSession(request);
  const params = new URL(request.url).searchParams;
  const roomId = params.get('roomId') || '';
  const id = params.get('id') || '';
  const allowed = roomId && ((!authenticationEnabled() && roomExists(roomId)) || (session && (session.role === 'admin' ? roomExists(roomId) : roomBelongsToUser(roomId, session.userId))));
  if (!allowed) return Response.json({ error: 'Room not found' }, { status: 404 });
  const image = imageForBrowser(roomId, id);
  if (!image) return Response.json({ error: 'Image not found' }, { status: 404 });
  try {
    const bytes = await readImage(image.fileName);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': image.mimeType, 'Cache-Control': 'private, no-store', 'Content-Length': String(bytes.byteLength) } });
  } catch { return Response.json({ error: 'Image not found' }, { status: 404 }); }
}
