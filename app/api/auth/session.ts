import { findActiveUserById } from '../../lib/database';

const COOKIE_NAME = 'maaviron_session';
export type Session = { role: 'admin' } | { role: 'user'; userId: string };

function configuredPassword() {
  return process.env.APP_PASSWORD?.trim() ?? '';
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function bytesToBase64Url(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signingKey() {
  const secret = process.env.SESSION_SECRET?.trim() || configuredPassword() || 'local-development-only';
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(value))));
}

export function authenticationEnabled() {
  return configuredPassword().length > 0;
}

export async function passwordMatches(candidate: string) {
  if (!authenticationEnabled()) return true;
  const [candidateHash, passwordHash] = await Promise.all([sha256(candidate), sha256(configuredPassword())]);
  return constantTimeEqual(candidateHash, passwordHash);
}

export async function getSession(request: Request): Promise<Session | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const value = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature || !constantTimeEqual(signature, await sign(encoded))) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as Session;
    if (parsed.role === 'admin') return parsed;
    if (parsed.role === 'user' && typeof parsed.userId === 'string' && findActiveUserById(parsed.userId)) return parsed;
  } catch { return null; }
  return null;
}

export async function requestIsAuthenticated(request: Request) {
  return Boolean(await getSession(request));
}

export async function requestIsAdmin(request: Request) {
  if (!authenticationEnabled()) return true;
  return (await getSession(request))?.role === 'admin';
}

export async function createSessionCookie(request: Request, session: Session) {
  const secure = process.env.FORCE_SECURE_COOKIE === 'true' || new URL(request.url).protocol === 'https:';
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${COOKIE_NAME}=${encoded}.${await sign(encoded)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(request: Request) {
  const secure = process.env.FORCE_SECURE_COOKIE === 'true' || new URL(request.url).protocol === 'https:';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}
