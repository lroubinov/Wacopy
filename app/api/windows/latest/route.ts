import { latestFileForComputer, latestForComputer, latestImageForComputer } from '../../../lib/database';
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
  const fileMessage = latestFileForComputer(computer.id);
  if (fileMessage && (!textMessage || fileMessage.updatedAt > textMessage.updatedAt) && (!imageMessage || fileMessage.updatedAt > imageMessage.updatedAt)) {
    return Response.json({ kind: 'file', id: fileMessage.id, mimeType: fileMessage.mimeType, byteSize: fileMessage.byteSize, fileName: fileMessage.originalName, fileUrl: `/api/windows/file?id=${encodeURIComponent(fileMessage.id)}`, updatedAt: fileMessage.updatedAt }, { headers });
  }
  if (imageMessage && (!textMessage || imageMessage.updatedAt > textMessage.updatedAt)) {
    return Response.json({ kind: 'image', id: imageMessage.id, mimeType: imageMessage.mimeType, byteSize: imageMessage.byteSize, imageUrl: `/api/windows/image?id=${encodeURIComponent(imageMessage.id)}`, updatedAt: imageMessage.updatedAt }, { headers });
  }
  return Response.json(textMessage ? { kind: 'text', ...textMessage } : { kind: null, id: null, text: '', updatedAt: null }, { headers });
}
