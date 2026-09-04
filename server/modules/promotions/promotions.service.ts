import type { ZodType } from 'zod';
import type { PromotionDefinition } from '../../../shared/domain/promotions.js';
import { slugify } from '../../../shared/domain/product.js';
import {
  promotionConfigByKind,
  type PromotionInputDto,
  type PromotionPatchDto,
} from '../../../shared/schemas/promotion.schema.js';
import { conflict, notFound } from '../../http/errors.js';
import { parseOrThrow } from '../../http/validate.js';
import { promotionRepository, type PromotionRepository } from '../../infra/promotionRepository.js';

export interface PromotionsService {
  list(includeInactive: boolean): Promise<PromotionDefinition[]>;
  create(input: PromotionInputDto): Promise<PromotionDefinition>;
  update(id: string, patch: PromotionPatchDto): Promise<PromotionDefinition>;
  remove(id: string): Promise<void>;
}

/** El `config` correcto para ese `kind`, o un 404 si el tipo no existe. */
function parseConfig(kind: PromotionDefinition['kind'], config: unknown): unknown {
  // El índice devuelve la unión de todos los esquemas; el `kind` ya eligió
  // cuál corresponde, así que se estrecha a "un validador cualquiera".
  const schema = promotionConfigByKind[kind] as ZodType<unknown> | undefined;
  if (!schema) throw notFound(`Tipo de promoción desconocido: "${kind}".`);
  return parseOrThrow(schema, config, 'Configuración inválida');
}

export function createPromotionsService(
  repository: PromotionRepository = promotionRepository,
): PromotionsService {
  return {
    list: (includeInactive) => repository.list({ includeInactive }),

    async create(input) {
      // El id sale del nombre si no lo mandan: el club escribe "Combo verano",
      // no "combo-verano".
      const id = input.id ?? slugify(input.label);

      const existing = await repository.list({ includeInactive: true });
      if (existing.some((promotion) => promotion.id === id)) {
        throw conflict(`Ya existe una promoción con el identificador "${id}".`);
      }

      const { id: _ignored, ...rest } = input;
      return repository.create(id, { ...rest, config: parseConfig(input.kind, input.config) });
    },

    remove: (id) => repository.remove(id),

    async update(id, patch) {
      // El `kind` no se puede cambiar: define qué estrategia corre y qué forma
      // tiene el config. Cambiarlo dejaría la promo con parámetros inválidos.
      const existing = (await repository.list({ includeInactive: true })).find(
        (promotion) => promotion.id === id,
      );
      if (!existing) throw notFound(`No existe la promoción "${id}".`);

      if (patch.config !== undefined) {
        patch = { ...patch, config: parseConfig(existing.kind, patch.config) };
      }

      return repository.update(id, patch);
    },
  };
}

export const promotionsService = createPromotionsService();
