import type { PromotionDefinition } from '../../shared/domain/promotions.js';
import type {
  PromotionInputDto,
  PromotionPatchDto,
} from '../../shared/schemas/promotion.schema.js';
import { toPromotion, type PromotionRow } from './mappers.js';
import { rowOf, rowsOf } from './postgrestResult.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'promotions';
const COLUMNS = 'id,kind,label,description,config,is_active,sort_order';

export interface PromotionRepository {
  list(options?: { includeInactive?: boolean }): Promise<PromotionDefinition[]>;
  create(id: string, input: Omit<PromotionInputDto, 'id'>): Promise<PromotionDefinition>;
  update(id: string, patch: PromotionPatchDto): Promise<PromotionDefinition>;
  remove(id: string): Promise<void>;
}

export const promotionRepository: PromotionRepository = {
  async list({ includeInactive = false } = {}) {
    let query = getSupabase().from(TABLE).select(COLUMNS);
    if (!includeInactive) query = query.eq('is_active', true);

    const result = await query.order('sort_order', { ascending: true });
    return rowsOf<PromotionRow>(result, 'promotions.list').map(toPromotion);
  },

  async create(id, input) {
    const result = await getSupabase()
      .from(TABLE)
      .insert({
        id,
        kind: input.kind,
        label: input.label,
        description: input.description,
        config: input.config,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      })
      .select(COLUMNS)
      .single();

    return toPromotion(
      rowOf<PromotionRow>(
        result,
        'promotions.create',
        'La base no devolvio la promocion recien creada.',
      ),
    );
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.config !== undefined) row.config = patch.config;

    const result = await getSupabase()
      .from(TABLE)
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    return toPromotion(
      rowOf<PromotionRow>(result, 'promotions.update', `No existe la promoción "${id}".`),
    );
  },

  async remove(id) {
    const result = await getSupabase().from(TABLE).delete().eq('id', id).select('id').maybeSingle();

    // Solo interesa que existiera: `rowOf` tira el 404 si la promo no estaba.
    rowOf<{ id: string }>(result, 'promotions.remove', `No existe la promoción "${id}".`);
  },
};
