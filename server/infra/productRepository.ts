import type { Product, ProductInput } from '../../shared/domain/product.js';
import type { StockLevel } from '../../shared/domain/stock.js';
import { notFound } from '../http/errors.js';
import { toProduct, type ProductRow } from './mappers.js';
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'products';
const STOCK_TABLE = 'product_stock';
/**
 * El stock viaja embebido con el producto: la ficha necesita saber si la
 * variante elegida sale a pedido antes de que el socio apriete comprar, y una
 * segunda consulta por producto sería una cascada de requests.
 */
const COLUMNS =
  'id,name,description,image_url,sizes_small,sizes_large,price_small,price_large,colors,size_chart_id,category,is_active,sort_order,created_at,updated_at,product_stock(size,color,units)';

export interface ProductRepository {
  /** Reemplaza el stock de un producto por la grilla que mandó el panel. */
  setStock(id: string, levels: readonly StockLevel[]): Promise<Product>;
  list(options?: { includeInactive?: boolean }): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  findManyByIds(ids: string[]): Promise<Map<string, Product>>;
  create(id: string, input: Omit<ProductInput, 'id'>): Promise<Product>;
  update(id: string, patch: Partial<ProductInput>): Promise<Product>;
  remove(id: string): Promise<void>;
}

const toRow = (patch: Partial<ProductInput>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.sizesSmall !== undefined) row.sizes_small = patch.sizesSmall;
  if (patch.sizesLarge !== undefined) row.sizes_large = patch.sizesLarge;
  if (patch.priceSmall !== undefined) row.price_small = patch.priceSmall;
  if (patch.priceLarge !== undefined) row.price_large = patch.priceLarge;
  if (patch.colors !== undefined) row.colors = patch.colors;
  if (patch.sizeChartId !== undefined) row.size_chart_id = patch.sizeChartId;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  return row;
};

export const productRepository: ProductRepository = {
  async setStock(id, levels) {
    const supabase = getSupabase();

    // Se reemplaza la grilla entera: una variante que el club borró de la
    // pantalla tiene que dejar de existir, no quedar con su último valor.
    const { error: borrado } = await supabase.from(STOCK_TABLE).delete().eq('product_id', id);
    if (borrado) throw toHttpError(borrado, 'products.setStock.clear');

    if (levels.length > 0) {
      const { error } = await supabase.from(STOCK_TABLE).insert(
        levels.map((level) => ({
          product_id: id,
          size: level.size,
          color: level.color ?? '',
          units: level.units,
        })),
      );
      if (error) throw toHttpError(error, 'products.setStock');
    }

    const saved = await productRepository.findById(id);
    if (!saved) throw notFound(`No existe el producto "${id}".`);
    return saved;
  },

  async list({ includeInactive = false } = {}) {
    let query = getSupabase().from(TABLE).select(COLUMNS);
    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw toHttpError(error, 'products.list');
    return (data as unknown as ProductRow[]).map(toProduct);
  },

  async findById(id) {
    const { data, error } = await getSupabase().from(TABLE).select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw toHttpError(error, 'products.findById');
    return data ? toProduct(data as unknown as ProductRow) : null;
  },

  async findManyByIds(ids) {
    if (ids.length === 0) return new Map();
    const { data, error } = await getSupabase().from(TABLE).select(COLUMNS).in('id', ids);
    if (error) throw toHttpError(error, 'products.findManyByIds');
    return new Map((data as unknown as ProductRow[]).map((row) => [row.id, toProduct(row)]));
  },

  async create(id, input) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .insert({ id, ...toRow(input) })
      .select(COLUMNS)
      .single();
    if (error) throw toHttpError(error, 'products.create');
    return toProduct(data as unknown as ProductRow);
  },

  async update(id, patch) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ ...toRow(patch), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw toHttpError(error, 'products.update');
    if (!data) throw notFound(`No existe el producto "${id}".`);
    return toProduct(data as unknown as ProductRow);
  },

  async remove(id) {
    const { error, count } = await getSupabase().from(TABLE).delete({ count: 'exact' }).eq('id', id);
    if (error) throw toHttpError(error, 'products.remove');
    if (count === 0) throw notFound(`No existe el producto "${id}".`);
  },
};
