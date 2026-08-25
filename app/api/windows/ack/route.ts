import { acknowledgeMessage } from '../../../lib/database';
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
  return Response.json({ cleared: acknowledgeMessage(computer.id, body.messageId) });
}
