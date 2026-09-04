import { ROUTES } from '../../../shared/api/contracts.js';
import {
  promotionInputSchema,
  promotionPatchSchema,
} from '../../../shared/schemas/promotion.schema.js';
import { Router } from '../../http/router.js';
import { created, noContent, ok } from '../../http/responses.js';
import { parseOrThrow } from '../../http/validate.js';
import { adminOnly, isAdminRequest } from '../../security/adminGuard.js';
import { promotionsService } from './promotions.service.js';

export const promotionRoutes = new Router()
  // Lectura pública: el carrito necesita las promos activas para previsualizar
  // el descuento. Las inactivas sólo las ve el panel.
  .get(ROUTES.promotions.collection, async (request) => {
    const wantsInactive = request.query.includeInactive === 'true';
    const includeInactive = wantsInactive && isAdminRequest(request);
    return ok(await promotionsService.list(includeInactive));
  })
  .post(
    ROUTES.promotions.collection,
    adminOnly(async (request) => {
      const input = parseOrThrow(promotionInputSchema, request.body, 'No se pudo crear la promoción');
      return created(await promotionsService.create(input));
    }),
  )
  .delete(
    ROUTES.promotions.pattern,
    adminOnly(async (request) => {
      await promotionsService.remove(request.params.id!);
      return noContent();
    }),
  )
  .patch(
    ROUTES.promotions.pattern,
    adminOnly(async (request) => {
      const patch = parseOrThrow(promotionPatchSchema, request.body, 'No se pudo actualizar la promoción');
      return ok(await promotionsService.update(request.params.id!, patch));
    }),
  );
