import { ROUTES } from '../../../shared/api/contracts';
import { promotionPatchSchema } from '../../../shared/schemas/promotion.schema';
import { Router } from '../../http/router';
import { ok } from '../../http/responses';
import { parseOrThrow } from '../../http/validate';
import { adminOnly, isAdminRequest } from '../../security/adminGuard';
import { promotionsService } from './promotions.service';

export const promotionRoutes = new Router()
  // Lectura pública: el carrito necesita las promos activas para previsualizar
  // el descuento. Las inactivas sólo las ve el panel.
  .get(ROUTES.promotions.collection, async (request) => {
    const wantsInactive = request.query.includeInactive === 'true';
    const includeInactive = wantsInactive && isAdminRequest(request);
    return ok(await promotionsService.list(includeInactive));
  })
  .patch(
    ROUTES.promotions.pattern,
    adminOnly(async (request) => {
      const patch = parseOrThrow(promotionPatchSchema, request.body, 'No se pudo actualizar la promoción');
      return ok(await promotionsService.update(request.params.id!, patch));
    }),
  );
