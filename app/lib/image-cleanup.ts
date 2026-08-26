import { expiredImageFiles } from './database';
import { deleteImage } from './image-storage';

export async function cleanupImages() {
  await Promise.allSettled(expiredImageFiles().map(({ fileName }) => deleteImage(fileName)));
}
