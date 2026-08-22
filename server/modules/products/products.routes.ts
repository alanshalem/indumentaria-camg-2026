import { ROUTES } from '../../../shared/api/contracts';
import { productInputSchema, productPatchSchema } from '../../../shared/schemas/product.schema';
import { Router } from '../../http/router';
import { created, noContent, ok } from '../../http/responses';
import { parseOrThrow } from '../../http/validate';
import { adminOnly, isAdminRequest } from '../../security/adminGuard';
import { productsService } from './products.service';

export const productRoutes = new Router()
  // Lectura pública del catálogo. Los inactivos sólo los ve un admin.
  .get(ROUTES.products.collection, async (request) => {
    const wantsInactive = request.query.includeInactive === 'true';
    const includeInactive = wantsInactive && isAdminRequest(request);
    return ok(await productsService.list(includeInactive));
  })
  .post(
    ROUTES.products.collection,
    adminOnly(async (request) => {
      const input = parseOrThrow(productInputSchema, request.body, 'No se pudo crear el producto');
      return created(await productsService.create(input));
    }),
  )
  .patch(
    ROUTES.products.pattern,
    adminOnly(async (request) => {
      const patch = parseOrThrow(productPatchSchema, request.body, 'No se pudo actualizar el producto');
      return ok(await productsService.update(request.params.id!, patch));
    }),
  )
  .delete(
    ROUTES.products.pattern,
    adminOnly(async (request) => {
      await productsService.remove(request.params.id!);
      return noContent();
    }),
  );
