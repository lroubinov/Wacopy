import { expiredImageFiles, expiredTransferFiles } from './database';
import { deleteImage } from './image-storage';

export async function cleanupImages() {
  await Promise.allSettled([...expiredImageFiles(), ...expiredTransferFiles()].map(({ fileName }) => deleteImage(fileName)));
}
