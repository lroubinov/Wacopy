import { imageForComputer } from '../../../lib/database';
import { readImage } from '../../../lib/image-storage';
import { authenticateWindowsComputer } from '../auth';

export async function GET(request: Request) {
  const computer = await authenticateWindowsComputer(request);
  if (!computer) return Response.json({ error: 'Unauthorized device' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  const image = imageForComputer(computer.id, id);
  if (!image) return Response.json({ error: 'Image not found' }, { status: 404 });
  try {
    const bytes = await readImage(image.fileName);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': image.mimeType, 'Cache-Control': 'private, no-store', 'Content-Length': String(bytes.byteLength) } });
  } catch { return Response.json({ error: 'Image not found' }, { status: 404 }); }
}
