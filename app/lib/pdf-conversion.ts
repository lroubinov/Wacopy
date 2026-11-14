import { PDFDocument } from 'pdf-lib';

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const MARGIN = 24;

export async function imageToPdf(bytes: Uint8Array, mimeType: 'image/png' | 'image/jpeg') {
  const document = await PDFDocument.create();
  const image = mimeType === 'image/jpeg'
    ? await document.embedJpg(bytes)
    : await document.embedPng(bytes);
  const pageSize = image.width > image.height ? A4_LANDSCAPE : A4_PORTRAIT;
  const page = document.addPage([pageSize.width, pageSize.height]);
  const availableWidth = pageSize.width - MARGIN * 2;
  const availableHeight = pageSize.height - MARGIN * 2;
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (pageSize.width - width) / 2,
    y: (pageSize.height - height) / 2,
    width,
    height,
  });
  return new Uint8Array(await document.save({ useObjectStreams: true }));
}
