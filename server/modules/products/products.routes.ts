import { ROUTES } from '../../../shared/api/contracts.js';
import {
  productInputSchema,
  productPatchSchema,
  stockGridSchema,
} from '../../../shared/schemas/product.schema.js';
import { Router } from '../../http/router.js';
import { created, noContent, ok } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { adminOnly, isAdminRequest } from '../../security/adminGuard.js';
import { productsService } from './products.service.js';

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
  // La grilla de stock va por su propia ruta: el club la edita cuando entra
  // mercadería, sin abrir el formulario largo del producto.
  .patch(
    ROUTES.products.stockPattern,
    adminOnly(async (request) => {
      const { levels } = parseOrThrow(stockGridSchema, request.body, 'No se pudo guardar el stock');
      return ok(await productsService.setStock(request.params.id!, levels));
    }),
  )
  .delete(
    ROUTES.products.pattern,
    adminOnly(async (request) => {
      await productsService.remove(request.params.id!);
      return noContent();
    }),
  );
