import { sendFile, sendImage } from '../../../lib/database';
import { cleanupImages } from '../../../lib/image-cleanup';
import { deleteImage, detectTransferType, MAX_TRANSFER_BYTES, saveImage } from '../../../lib/image-storage';
import { authenticatePhone } from '../auth';

function safePdfName(value: string) {
  const cleaned = value.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  if (!cleaned) return 'WACopy-document.pdf';
  return cleaned.toLocaleLowerCase('en-US').endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

export async function POST(request: Request) {
  const phone = await authenticatePhone(request);
  if (!phone) return Response.json({ error: 'Unauthorized phone' }, { status: 401 });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_TRANSFER_BYTES + 1024 * 1024) return Response.json({ error: 'File is too large' }, { status: 413 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: 'Invalid form data' }, { status: 400 }); }

  const target = form.get('targetComputerId');
  const upload = form.get('file');
  if (typeof target !== 'string' || !(upload instanceof File)) return Response.json({ error: 'Target and file are required' }, { status: 400 });
  if (!upload.size || upload.size > MAX_TRANSFER_BYTES) return Response.json({ error: 'File is too large' }, { status: 413 });

  const bytes = new Uint8Array(await upload.arrayBuffer());
  const detected = detectTransferType(bytes);
  if (!detected) return Response.json({ error: 'Only PNG, JPEG and PDF files are supported' }, { status: 415 });

  await cleanupImages();
  const storedName = await saveImage(bytes, detected.extension);
  const message = detected.kind === 'image'
    ? sendImage(phone.roomId, phone.id, target, storedName, detected.mimeType, bytes.byteLength)
    : sendFile(phone.roomId, phone.id, target, storedName, safePdfName(upload.name), detected.mimeType, bytes.byteLength);

  if (!message) {
    await deleteImage(storedName);
    return Response.json({ error: 'Target computer was not found' }, { status: 404 });
  }
  return Response.json({ message, kind: detected.kind });
}
