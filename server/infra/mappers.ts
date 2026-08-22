import type { Order, OrderItem, OrderStatus } from '../../shared/domain/order.js';
import type { Product, ProductColor } from '../../shared/domain/product.js';
import type { AppliedPromotion, PromotionDefinition, PromotionKind } from '../../shared/domain/promotions.js';
import { isSizeChartId } from '../../shared/domain/sizeCharts.js';

/** Filas crudas de Postgres. snake_case vive sólo acá. */
export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  sizes_small: string[] | null;
  sizes_large: string[] | null;
  price_small: number;
  price_large: number;
  colors: ProductColor[] | null;
  size_chart_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  code: string;
  customer_name: string;
  customer_last_name: string;
  phone: string | null;
  email: string | null;
  items: OrderItem[] | null;
  subtotal: number | null;
  promotions: AppliedPromotion[] | null;
  total: number | null;
  status: string | null;
  created_at: string;
}

export interface PromotionRow {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  config: unknown;
  is_active: boolean;
  sort_order: number;
}

/**
 * Anti-corruption layer: el dominio habla camelCase y no tolera nulls.
 * Si mañana cambia una columna, sólo cambia este archivo.
 */
export const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  imageUrl: row.image_url,
  sizesSmall: row.sizes_small ?? [],
  sizesLarge: row.sizes_large ?? [],
  priceSmall: row.price_small,
  priceLarge: row.price_large,
  colors: row.colors ?? [],
  sizeChartId: isSizeChartId(row.size_chart_id) ? row.size_chart_id : null,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toOrder = (row: OrderRow): Order => ({
  code: row.code,
  timestamp: new Date(row.created_at).getTime(),
  customerName: row.customer_name,
  customerLastName: row.customer_last_name,
  phone: row.phone ?? '',
  email: row.email,
  items: row.items ?? [],
  subtotal: row.subtotal ?? row.total ?? 0,
  promotions: row.promotions ?? [],
  total: row.total ?? 0,
  status: (row.status as OrderStatus) ?? 'pending',
});

export const toPromotion = (row: PromotionRow): PromotionDefinition => ({
  id: row.id,
  kind: row.kind as PromotionKind,
  label: row.label,
  description: row.description ?? '',
  config: row.config,
  isActive: row.is_active,
  sortOrder: row.sort_order,
});
