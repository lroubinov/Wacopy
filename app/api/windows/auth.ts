import { findDeviceByTokenHash } from '../../lib/database';
import { bearerToken, hashToken } from '../../lib/tokens';

export async function authenticateWindowsComputer(request: Request) {
  const token = bearerToken(request);
  if (token.length < 32) return null;
  return findDeviceByTokenHash(await hashToken(token), 'computer') ?? null;
}
