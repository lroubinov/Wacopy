import { phoneContext } from '../../../lib/database';
import { authenticatePhone } from '../auth';

export async function GET(request: Request) {
  const phone = await authenticatePhone(request);
  if (!phone) return Response.json({ error: 'Unauthorized phone' }, { status: 401 });
  return Response.json(phoneContext(phone.id, phone.roomId), { headers: { 'Cache-Control': 'no-store' } });
}
