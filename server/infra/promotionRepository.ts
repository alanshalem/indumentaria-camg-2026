import type { PromotionDefinition } from '../../shared/domain/promotions.js';
import type { PromotionPatchDto } from '../../shared/schemas/promotion.schema.js';
import { notFound } from '../http/errors.js';
import { toPromotion, type PromotionRow } from './mappers.js';
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'promotions';
const COLUMNS = 'id,kind,label,description,config,is_active,sort_order';

export interface PromotionRepository {
  list(options?: { includeInactive?: boolean }): Promise<PromotionDefinition[]>;
  update(id: string, patch: PromotionPatchDto): Promise<PromotionDefinition>;
}

export const promotionRepository: PromotionRepository = {
  async list({ includeInactive = false } = {}) {
    let query = getSupabase().from(TABLE).select(COLUMNS);
    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw toHttpError(error, 'promotions.list');
    return (data as unknown as PromotionRow[]).map(toPromotion);
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.config !== undefined) row.config = patch.config;

    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw toHttpError(error, 'promotions.update');
    if (!data) throw notFound(`No existe la promoción "${id}".`);
    return toPromotion(data as unknown as PromotionRow);
  },
};
