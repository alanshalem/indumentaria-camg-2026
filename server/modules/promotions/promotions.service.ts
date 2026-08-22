import type { ZodType } from 'zod';
import type { PromotionDefinition } from '../../../shared/domain/promotions.js';
import {
  promotionConfigByKind,
  type PromotionPatchDto,
} from '../../../shared/schemas/promotion.schema.js';
import { notFound } from '../../http/errors.js';
import { parseOrThrow } from '../../http/validate.js';
import { promotionRepository, type PromotionRepository } from '../../infra/promotionRepository.js';

export interface PromotionsService {
  list(includeInactive: boolean): Promise<PromotionDefinition[]>;
  update(id: string, patch: PromotionPatchDto): Promise<PromotionDefinition>;
}

export function createPromotionsService(
  repository: PromotionRepository = promotionRepository,
): PromotionsService {
  return {
    list: (includeInactive) => repository.list({ includeInactive }),

    async update(id, patch) {
      // El `kind` no se puede cambiar: define qué estrategia corre y qué forma
      // tiene el config. Cambiarlo dejaría la promo con parámetros inválidos.
      const existing = (await repository.list({ includeInactive: true })).find(
        (promotion) => promotion.id === id,
      );
      if (!existing) throw notFound(`No existe la promoción "${id}".`);

      if (patch.config !== undefined) {
        // El índice devuelve la unión de todos los esquemas; el `kind` ya eligió
        // cuál corresponde, así que se estrecha a "un validador cualquiera".
        const schema = promotionConfigByKind[existing.kind] as ZodType<unknown> | undefined;
        if (!schema) throw notFound(`La promoción "${id}" tiene un tipo desconocido.`);
        patch = { ...patch, config: parseOrThrow(schema, patch.config, 'Configuración inválida') };
      }

      return repository.update(id, patch);
    },
  };
}

export const promotionsService = createPromotionsService();
