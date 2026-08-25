import { createDevice, deviceBelongsToUser, revokeDevice, roomBelongsToUser, type DeviceType } from '../../../lib/database';
import { createSecretToken, hashToken } from '../../../lib/tokens';
import { getSession } from '../../auth/session';

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || session.role !== 'user') return Response.json({ error: 'User required' }, { status: 401 });
  let body: { roomId?: unknown; type?: unknown; name?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.roomId !== 'string' || !roomBelongsToUser(body.roomId, session.userId) || (body.type !== 'phone' && body.type !== 'computer') || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80) {
    return Response.json({ error: 'Invalid device details' }, { status: 400 });
  }
  const token = createSecretToken();
  const device = createDevice(body.roomId, body.type as DeviceType, body.name, await hashToken(token));
  return Response.json({ device, token });
}

export async function DELETE(request: Request) {
  const session = await getSession(request);
  if (!session || session.role !== 'user') return Response.json({ error: 'User required' }, { status: 401 });
  let body: { deviceId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof body.deviceId !== 'string' || !deviceBelongsToUser(body.deviceId, session.userId)) return Response.json({ error: 'Device not found' }, { status: 404 });
  return Response.json({ revoked: revokeDevice(body.deviceId) });
}
