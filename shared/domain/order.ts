import type { Ars } from './money.js';
import type { AppliedPromotion } from './promotions.js';
import type { SizeTier } from './product.js';

export const ORDER_STATUSES = ['pending', 'delivered'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  delivered: 'Entregado',
};

/** Línea del pedido: snapshot inmutable del producto al momento de la compra. */
export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  /** Se guarda para poder auditar por qué se cobró ese precio. */
  sizeTier: SizeTier;
  color: string | null;
  quantity: number;
  unitPrice: Ars;
}

export interface Order {
  code: string;
  timestamp: number;
  customerName: string;
  customerLastName: string;
  /** El club necesita contactar al socio para cobrar: es obligatorio. */
  phone: string;
  email: string | null;
  items: OrderItem[];
  /** Suma de las líneas antes de promociones. */
  subtotal: Ars;
  promotions: AppliedPromotion[];
  total: Ars;
  status: OrderStatus;
}

/** Lo que el cliente puede pedir. Nunca incluye precios: los pone el servidor. */
export interface OrderItemInput {
  productId: string;
  size: string;
  color?: string | null;
  quantity: number;
}

export interface CreateOrderInput {
  customerName: string;
  customerLastName: string;
  phone: string;
  email?: string | null;
  items: OrderItemInput[];
}

export const lineSubtotal = (item: Pick<OrderItem, 'unitPrice' | 'quantity'>): Ars =>
  item.unitPrice * item.quantity;

export const computeSubtotal = (items: readonly Pick<OrderItem, 'unitPrice' | 'quantity'>[]): Ars =>
  items.reduce((sum, item) => sum + lineSubtotal(item), 0);

export const countOrderUnits = (items: readonly Pick<OrderItem, 'quantity'>[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.includes(value as OrderStatus);

export const nextStatus = (status: OrderStatus): OrderStatus =>
  status === 'delivered' ? 'pending' : 'delivered';

export const customerFullName = (order: Pick<Order, 'customerName' | 'customerLastName'>): string =>
  `${order.customerName} ${order.customerLastName}`.trim();

/** Etiqueta de una línea para tablas y CSV: "2× Remera (M · Roja)". */
export const describeItem = (item: OrderItem): string =>
  `${item.quantity}× ${item.productName} (${[item.size, item.color].filter(Boolean).join(' · ')})`;
