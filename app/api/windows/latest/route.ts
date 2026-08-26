import { latestForComputer, latestImageForComputer } from '../../../lib/database';
import { cleanupImages } from '../../../lib/image-cleanup';
import { authenticateWindowsComputer } from '../auth';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(request: Request) {
  const computer = await authenticateWindowsComputer(request);
  if (!computer) {
    return Response.json({ error: 'Unauthorized device' }, { status: 401, headers });
  }
  await cleanupImages();
  const textMessage = latestForComputer(computer.id);
  const imageMessage = latestImageForComputer(computer.id);
  if (imageMessage && (!textMessage || imageMessage.updatedAt > textMessage.updatedAt)) {
    return Response.json({ kind: 'image', id: imageMessage.id, mimeType: imageMessage.mimeType, byteSize: imageMessage.byteSize, imageUrl: `/api/windows/image?id=${encodeURIComponent(imageMessage.id)}`, updatedAt: imageMessage.updatedAt }, { headers });
  }
  return Response.json(textMessage ? { kind: 'text', ...textMessage } : { kind: null, id: null, text: '', updatedAt: null }, { headers });
}
