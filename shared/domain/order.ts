import type { Ars } from './money.js';
import type { AppliedPromotion } from './promotions.js';
import type { SizeTier } from './product.js';

/**
 * Ciclo de vida real del pedido: el socio lo genera, paga, la prenda llega y
 * la retira. El modelo anterior (pendiente/entregado) juntaba tres momentos
 * distintos en uno solo y no permitía avisarle nada en el medio.
 */
export const ORDER_STATUSES = ['pending', 'paid', 'ready', 'delivered'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pago confirmado',
  ready: 'Listo para retirar',
  delivered: 'Entregado',
};

/** El único estado terminal: sirve para separar lo pendiente de lo cerrado. */
export const isOpenOrder = (status: OrderStatus): boolean => status !== 'delivered';

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

/**
 * El pedido tal como lo ve la página pública de seguimiento.
 *
 * Sin teléfono ni email: la página muestra el estado, no los datos de contacto.
 * Si alguien reenvía el link, no expone la información personal del socio.
 */
export type PublicOrder = Omit<Order, 'phone' | 'email'>;

export const toPublicOrder = ({ phone: _phone, email: _email, ...rest }: Order): PublicOrder => rest;

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
  /** Obligatorio: por acá viajan el código, el pago y el aviso de retiro. */
  email: string;
  items: OrderItemInput[];
}

export const lineSubtotal = (item: Pick<OrderItem, 'unitPrice' | 'quantity'>): Ars =>
  item.unitPrice * item.quantity;

export const computeSubtotal = (items: readonly Pick<OrderItem, 'unitPrice' | 'quantity'>[]): Ars =>
  items.reduce((sum, item) => sum + lineSubtotal(item), 0);

export const countOrderUnits = (items: readonly Pick<OrderItem, 'quantity'>[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export const customerFullName = (order: Pick<Order, 'customerName' | 'customerLastName'>): string =>
  `${order.customerName} ${order.customerLastName}`.trim();

/** Etiqueta de una línea para tablas y CSV: "2× Remera (M · Roja)". */
export const describeItem = (item: OrderItem): string =>
  `${item.quantity}× ${item.productName} (${[item.size, item.color].filter(Boolean).join(' · ')})`;
