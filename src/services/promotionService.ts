import { ROUTES } from '@shared/api/contracts';
import type { PromotionDefinition } from '@shared/domain/promotions';
import type { PromotionPatchDto } from '@shared/schemas/promotion.schema';
import { httpClient } from './httpClient';

export const promotionService = {
  /** `includeInactive` sólo tiene efecto con sesión admin; el servidor lo verifica. */
  list: (options: { includeInactive?: boolean } = {}) =>
    httpClient.get<PromotionDefinition[]>(ROUTES.promotions.collection, {
      query: options.includeInactive ? { includeInactive: 'true' } : undefined,
    }),

  update: (id: string, patch: PromotionPatchDto) =>
    httpClient.patch<PromotionDefinition>(ROUTES.promotions.byId(id), patch),
};
