import { sendImage } from '../../../lib/database';
import { cleanupImages } from '../../../lib/image-cleanup';
import { deleteImage, detectImageType, MAX_IMAGE_BYTES, saveImage } from '../../../lib/image-storage';
import { authenticatePhone } from '../auth';

export async function POST(request: Request) {
  const phone = await authenticatePhone(request);
  if (!phone) return Response.json({ error: 'Unauthorized phone' }, { status: 401 });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES + 1024 * 1024) return Response.json({ error: 'Image is too large' }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Invalid form data' }, { status: 400 }); }
  const target = form.get('targetComputerId');
  const upload = form.get('image');
  if (typeof target !== 'string' || !(upload instanceof File)) return Response.json({ error: 'Target and image are required' }, { status: 400 });
  if (!upload.size || upload.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Image is too large' }, { status: 413 });
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected) return Response.json({ error: 'Only PNG and JPEG images are supported' }, { status: 415 });
  await cleanupImages();
  const fileName = await saveImage(bytes, detected.extension);
  const message = sendImage(phone.roomId, phone.id, target, fileName, detected.mimeType, bytes.byteLength);
  if (!message) {
    await deleteImage(fileName);
    return Response.json({ error: 'Target computer was not found' }, { status: 404 });
  }
  return Response.json({ message });
}
