import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const root = resolve(process.env.WACOPY_IMAGE_PATH || './data/images');

export function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mimeType: 'image/png', extension: 'png' } as const;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' } as const;
  return null;
}

export async function saveImage(bytes: Uint8Array, extension: string) {
  await mkdir(root, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${extension}`;
  await writeFile(resolve(root, fileName), bytes, { flag: 'wx' });
  return fileName;
}

export async function readImage(fileName: string) { return readFile(resolve(root, fileName)); }
export async function deleteImage(fileName: string) { await rm(resolve(root, fileName), { force: true }); }
