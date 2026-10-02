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
import { productsService, type ProductsService } from './products.service.js';

/** Rutas del catálogo. El servicio entra por parámetro: ver `makeApiRouter`. */
export const makeProductRoutes = (products: ProductsService = productsService): Router =>
  new Router()
    // Lectura pública del catálogo. Los inactivos sólo los ve un admin.
    .get(ROUTES.products.collection, async (request) => {
      const wantsInactive = request.query.includeInactive === 'true';
      const includeInactive = wantsInactive && isAdminRequest(request);
      return ok(await products.list(includeInactive));
    })
    .post(
      ROUTES.products.collection,
      adminOnly(async (request) => {
        const input = parseOrThrow(productInputSchema, request.body, 'No se pudo crear el producto');
        return created(await products.create(input));
      }),
    )
    .patch(
      ROUTES.products.pattern,
      adminOnly(async (request) => {
        const patch = parseOrThrow(productPatchSchema, request.body, 'No se pudo actualizar el producto');
        return ok(await products.update(request.params.id!, patch));
      }),
    )
    // La grilla de stock va por su propia ruta: el club la edita cuando entra
    // mercadería, sin abrir el formulario largo del producto.
    .patch(
      ROUTES.products.stockPattern,
      adminOnly(async (request) => {
        const { levels } = parseOrThrow(stockGridSchema, request.body, 'No se pudo guardar el stock');
        return ok(await products.setStock(request.params.id!, levels));
      }),
    )
    .delete(
      ROUTES.products.pattern,
      adminOnly(async (request) => {
        await products.remove(request.params.id!);
        return noContent();
      }),
    );

export const productRoutes = makeProductRoutes();
