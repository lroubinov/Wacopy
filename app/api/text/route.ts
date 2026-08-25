import { requestIsAdmin } from '../auth/session';
import { getSharedState, setSharedText } from './store';

const noCacheHeaders = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(request: Request) {
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  return Response.json(getSharedState(), { headers: noCacheHeaders });
}

export async function POST(request: Request) {
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  let body: { text?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }
  if (body.text.length > 20000) {
    return Response.json({ error: 'Text is too long' }, { status: 413 });
  }

  const next = setSharedText(body.text);
  return Response.json(next, { headers: noCacheHeaders });
}
