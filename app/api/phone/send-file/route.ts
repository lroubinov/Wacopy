import { sendFile, sendImage } from '../../../lib/database';
import { cleanupImages } from '../../../lib/image-cleanup';
import { deleteImage, detectTransferType, MAX_TRANSFER_BYTES, saveImage } from '../../../lib/image-storage';
import { imageToPdf } from '../../../lib/pdf-conversion';
import { authenticatePhone } from '../auth';

function safePdfName(value: string) {
  const cleaned = value.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  if (!cleaned) return 'WACopy-document.pdf';
  const baseName = cleaned.replace(/\.[^.]+$/, '').trim() || 'WACopy-document';
  return `${baseName}.pdf`;
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
  const convertToPdf = form.get('convertToPdf') === 'true' && detected.kind === 'image';
  const transferredBytes = convertToPdf
    ? await imageToPdf(bytes, detected.mimeType)
    : bytes;
  const transferredType = convertToPdf ? { kind: 'file' as const, extension: 'pdf', mimeType: 'application/pdf' } : detected;
  const storedName = await saveImage(transferredBytes, transferredType.extension);
  const message = transferredType.kind === 'image'
    ? sendImage(phone.roomId, phone.id, target, storedName, transferredType.mimeType, transferredBytes.byteLength)
    : sendFile(phone.roomId, phone.id, target, storedName, safePdfName(upload.name), transferredType.mimeType, transferredBytes.byteLength);

  if (!message) {
    await deleteImage(storedName);
    return Response.json({ error: 'Target computer was not found' }, { status: 404 });
  }
  return Response.json({ message, kind: transferredType.kind, converted: convertToPdf });
}
