import { fileForComputer } from '../../../lib/database';
import { readImage } from '../../../lib/image-storage';
import { authenticateWindowsComputer } from '../auth';

function contentDisposition(name: string) {
  return `attachment; filename="WACopy-document.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const computer = await authenticateWindowsComputer(request);
  if (!computer) return Response.json({ error: 'Unauthorized device' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  const file = fileForComputer(computer.id, id);
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
  try {
    const bytes = await readImage(file.fileName);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': file.mimeType, 'Content-Disposition': contentDisposition(file.originalName), 'Cache-Control': 'private, no-store', 'Content-Length': String(bytes.byteLength) } });
  } catch { return Response.json({ error: 'File not found' }, { status: 404 }); }
}
