import { ROUTES, type UploadResponse } from '@shared/api/contracts';
import type { Product, ProductInput } from '@shared/domain/product';
import type { ProductImageUploadDto } from '@shared/schemas/product.schema';
import { httpClient } from './httpClient';

/** Lee el archivo como base64 puro, sin el prefijo `data:<mime>;base64,`. */
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });

export const catalogService = {
  /** `includeInactive` sólo tiene efecto con sesión admin; el servidor lo verifica. */
  list: (options: { includeInactive?: boolean } = {}) =>
    httpClient.get<Product[]>(ROUTES.products.collection, {
      query: options.includeInactive ? { includeInactive: 'true' } : undefined,
    }),

  create: (input: ProductInput) => httpClient.post<Product>(ROUTES.products.collection, input),

  update: (id: string, patch: Partial<ProductInput>) =>
    httpClient.patch<Product>(ROUTES.products.byId(id), patch),

  remove: (id: string) => httpClient.delete<void>(ROUTES.products.byId(id)),

  async uploadImage(file: File): Promise<string> {
    const payload: ProductImageUploadDto = {
      fileName: file.name,
      contentType: file.type as ProductImageUploadDto['contentType'],
      dataBase64: await toBase64(file),
    };
    const { url } = await httpClient.post<UploadResponse>(ROUTES.uploads.productImage, payload);
    return url;
  },
};
