import { sendToBrowser, sendToComputer } from '../../../lib/database';
import { authenticatePhone } from '../auth';

export async function POST(request: Request) {
  const phone = await authenticatePhone(request);
  if (!phone) return Response.json({ error: 'Unauthorized phone' }, { status: 401 });
  let body: { targetComputerId?: unknown; text?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.targetComputerId !== 'string' || typeof body.text !== 'string' || !body.text.trim()) {
    return Response.json({ error: 'Target and text are required' }, { status: 400 });
  }
  if (body.text.length > 20000) return Response.json({ error: 'Text is too long' }, { status: 413 });
  const message = body.targetComputerId === 'browser'
    ? sendToBrowser(phone.roomId, phone.id, body.text)
    : sendToComputer(phone.roomId, phone.id, body.targetComputerId, body.text);
  if (!message) return Response.json({ error: 'Target computer was not found' }, { status: 404 });
  return Response.json({ message });
}
