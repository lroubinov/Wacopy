import { requestIsAdmin } from '../../auth/session';
import { createDevice, revokeDevice, type DeviceType } from '../../../lib/database';
import { createSecretToken, hashToken } from '../../../lib/tokens';

export async function POST(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let body: { roomId?: unknown; type?: unknown; name?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.roomId !== 'string' || (body.type !== 'phone' && body.type !== 'computer') || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80) {
    return Response.json({ error: 'Invalid device details' }, { status: 400 });
  }
  const token = createSecretToken();
  try {
    const device = createDevice(body.roomId, body.type as DeviceType, body.name, await hashToken(token));
    return Response.json({ device, token });
  } catch {
    return Response.json({ error: 'Room was not found' }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let body: { deviceId?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.deviceId !== 'string') return Response.json({ error: 'Device is required' }, { status: 400 });
  return Response.json({ revoked: revokeDevice(body.deviceId) });
}
