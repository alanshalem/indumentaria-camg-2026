import type { Order, OrderItem, OrderStatus } from '../../shared/domain/order.js';
import { isProductCategory, type Product, type ProductColor } from '../../shared/domain/product.js';
import type { AppliedPromotion, PromotionDefinition, PromotionKind } from '../../shared/domain/promotions.js';
import { isPaymentMethod } from '../../shared/domain/payment.js';
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
  category: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Viene del select embebido; ausente en las consultas que no lo piden. */
  product_stock?: StockRow[] | null;
}

export interface StockRow {
  size: string;
  color: string | null;
  units: number;
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
  payment_method: string | null;
  payment_link: string | null;
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
  // Un valor desconocido no rompe el catálogo: cae en accesorios y el filtro
  // sigue funcionando hasta que alguien lo corrija desde el panel.
  category: isProductCategory(row.category) ? row.category : 'accesorios',
  isActive: row.is_active,
  sortOrder: row.sort_order,
  // La columna guarda '' para "sin color"; el dominio usa null.
  stock: (row.product_stock ?? []).map((level) => ({
    size: level.size,
    color: level.color === '' ? null : level.color,
    units: level.units,
  })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Los pedidos viejos no tienen los campos nuevos: valores neutros. */
const toOrderItem = (item: OrderItem): OrderItem => ({
  ...item,
  backorderedUnits: item.backorderedUnits ?? 0,
  delivered: item.delivered ?? false,
});

/**
 * Las columnas que se escriben al crear un pedido.
 *
 * `created_at` lo pone la base y el resto sale del dominio. Es `Required` a
 * propósito: si mañana `Order` gana un campo que hay que persistir, agregarlo
 * acá es obligatorio y el compilador lo exige en `toOrderRow`.
 */
export type OrderInsert = Required<Omit<OrderRow, 'created_at'>>;

/**
 * Dominio → fila, la dirección que faltaba.
 *
 * El `insert` estaba escrito a mano columna por columna y se olvidó de
 * `payment_method`: el servicio lo seteaba, el repositorio lo tiraba y el
 * pedido quedaba "Sin definir" sin que nada fallara. Con el mapper tipado, un
 * campo nuevo en `Order` rompe la compilación hasta que se decide qué hacer
 * con él.
 */
export const toOrderRow = (order: Order): OrderInsert => ({
  code: order.code,
  customer_name: order.customerName,
  customer_last_name: order.customerLastName,
  phone: order.phone,
  email: order.email,
  items: order.items,
  subtotal: order.subtotal,
  promotions: order.promotions,
  total: order.total,
  status: order.status,
  payment_method: order.paymentMethod,
  payment_link: order.paymentLink,
});

export const toOrder = (row: OrderRow): Order => ({
  code: row.code,
  timestamp: new Date(row.created_at).getTime(),
  customerName: row.customer_name,
  customerLastName: row.customer_last_name,
  phone: row.phone ?? '',
  email: row.email,
  items: (row.items ?? []).map(toOrderItem),
  subtotal: row.subtotal ?? row.total ?? 0,
  promotions: row.promotions ?? [],
  total: row.total ?? 0,
  status: (row.status as OrderStatus) ?? 'pending',
  // Un valor desconocido no rompe la tabla: queda como "sin definir".
  paymentMethod: isPaymentMethod(row.payment_method) ? row.payment_method : null,
  paymentLink: row.payment_link,
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
