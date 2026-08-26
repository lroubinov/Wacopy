import { acknowledgeImage, acknowledgeMessage } from '../../../lib/database';
import { deleteImage } from '../../../lib/image-storage';
import { authenticateWindowsComputer } from '../auth';

export async function POST(request: Request) {
  const computer = await authenticateWindowsComputer(request);
  if (!computer) {
    return Response.json({ error: 'Unauthorized device' }, { status: 401 });
  }
  let body: { messageId?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.messageId !== 'string') {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }
  const textCleared = acknowledgeMessage(computer.id, body.messageId);
  const imageFile = textCleared ? null : acknowledgeImage('computer', computer.id, body.messageId);
  if (imageFile) await deleteImage(imageFile);
  return Response.json({ cleared: textCleared || Boolean(imageFile) });
}
