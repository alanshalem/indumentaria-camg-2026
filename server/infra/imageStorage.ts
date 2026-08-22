import { getConfig } from '../config/env';
import { internalError } from '../http/errors';
import { getSupabase } from './supabaseClient';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export interface ImageStorage {
  upload(input: { fileName: string; contentType: string; data: Buffer }): Promise<string>;
}

/** Nombre de objeto estable, sin colisiones y sin caracteres raros del original. */
function buildObjectName(fileName: string, contentType: string, suffix: string): string {
  const extension = EXTENSION_BY_TYPE[contentType] ?? 'bin';
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'producto';
  return `${base}-${suffix}.${extension}`;
}

export const imageStorage: ImageStorage = {
  async upload({ fileName, contentType, data }) {
    const { imageBucket } = getConfig();
    const objectName = buildObjectName(fileName, contentType, Date.now().toString(36));
    const bucket = getSupabase().storage.from(imageBucket);

    const { error } = await bucket.upload(objectName, data, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      console.error('[storage] upload:', error.message);
      throw internalError(
        `No se pudo subir la imagen al bucket "${imageBucket}". Verificá que exista y sea público.`,
      );
    }

    return bucket.getPublicUrl(objectName).data.publicUrl;
  },
};
