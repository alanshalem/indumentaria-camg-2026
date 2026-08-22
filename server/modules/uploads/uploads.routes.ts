import { ROUTES } from '../../../shared/api/contracts.js';
import { productImageUploadSchema } from '../../../shared/schemas/product.schema.js';
import { payloadTooLarge } from '../../http/errors.js';
import { Router } from '../../http/router.js';
import { created } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { adminOnly } from '../../security/adminGuard.js';
import { imageStorage } from '../../infra/imageStorage.js';

/** Vercel corta los cuerpos serverless en ~4.5 MB; avisamos antes de intentarlo. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const uploadRoutes = new Router().post(
  ROUTES.uploads.productImage,
  adminOnly(async (request) => {
    const input = parseOrThrow(productImageUploadSchema, request.body, 'No se pudo subir la imagen');
    const data = Buffer.from(input.dataBase64, 'base64');

    if (data.byteLength === 0) throw payloadTooLarge('El archivo llegó vacío.');
    if (data.byteLength > MAX_IMAGE_BYTES) {
      throw payloadTooLarge('La imagen supera los 4 MB. Comprimila antes de subirla.');
    }

    const url = await imageStorage.upload({
      fileName: input.fileName,
      contentType: input.contentType,
      data,
    });
    return created({ url });
  }),
);
