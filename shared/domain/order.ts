import type { Ars } from './money.js';
import type { AppliedPromotion } from './promotions.js';
import type { SizeTier } from './product.js';
import type { PaymentMethod } from './payment.js';

/**
 * Ciclo de vida real del pedido: el socio lo genera, paga, la prenda llega y
 * la retira. El modelo anterior (pendiente/entregado) juntaba tres momentos
 * distintos en uno solo y no permitía avisarle nada en el medio.
 */
export const ORDER_STAGES = ['pending', 'deposit', 'paid', 'ready', 'delivered'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

/**
 * Eliminar un pedido no lo borra: lo saca del circuito.
 *
 * `cancelled` va aparte del array ordenado a propósito. Media app recorre las
 * etapas como una secuencia —la línea de tiempo, los avisos que faltaron— y un
 * pedido eliminado no está "después de entregado": está afuera. Meterlo en el
 * mismo array hacía, por ejemplo, que el Excel lo contara como confirmado y el
 * club terminara encargándole esa prenda al proveedor.
 */
export const ORDER_STATUSES = [...ORDER_STAGES, 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente de pago',
  // Hay socios que señan y no completan el pago: sin esta etapa el club los
  // tenía que dejar en "pendiente" y no distinguía a quién ya le entró plata.
  deposit: 'Seña recibida',
  paid: 'Pago confirmado',
  ready: 'Listo para retirar',
  delivered: 'Entregado',
  cancelled: 'Eliminado',
};

export const isCancelled = (status: OrderStatus): boolean => status === 'cancelled';

/** `true` sólo para las etapas del circuito. Estrecha el tipo. */
export const isStage = (status: OrderStatus): status is OrderStage =>
  (ORDER_STAGES as readonly string[]).includes(status);

/**
 * Si el pedido suma en la facturación y en lo que hay que encargar.
 * Un pedido eliminado no cuenta en ningún total.
 */
export const countsForBilling = (status: OrderStatus): boolean => !isCancelled(status);

/** Pendiente de cerrar: ni entregado ni eliminado. */
export const isOpenOrder = (status: OrderStatus): boolean =>
  status !== 'delivered' && !isCancelled(status);

/**
 * A partir de acá el pedido es un compromiso del socio y el club le puede
 * encargar la prenda al proveedor. Es la línea que separa eso de lo que
 * todavía es una intención.
 *
 * Un pedido eliminado no cuenta nunca, aunque haya pasado por estados
 * posteriores a "pendiente".
 *
 * Vive en el dominio y no en el exportador de Excel —donde estaba— porque es
 * la regla más cara del sistema: si se equivoca, el club compra mercadería de
 * pedidos que no se concretaron.
 */
export const isConfirmed = (status: OrderStatus): boolean =>
  status !== 'pending' && countsForBilling(status);

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
  /**
   * Unidades de esta línea que no había en stock y salen a pedido.
   * Cero —o ausente, en pedidos anteriores al inventario— es entrega normal.
   */
  backorderedUnits: number;
  /**
   * Marca de control interno: esta prenda ya se le entregó al socio.
   *
   * Es independiente del estado del pedido. Sirve para los pedidos que se
   * entregan en partes —una prenda estaba y la otra salió a pedido— y **no
   * dispara ningún mail**: el socio se entera cuando el pedido entero pasa a
   * "Entregado".
   */
  delivered: boolean;
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
  /** Cómo paga el socio. `null` hasta que el club lo registra. */
  paymentMethod: PaymentMethod | null;
  /** Link de cobro de Mercado Pago, cargado a mano por el club. */
  paymentLink: string | null;
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
  /** Cómo elige pagar el socio. El club lo puede corregir después. */
  paymentMethod: PaymentMethod;
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

/** Cuántas líneas del pedido ya se entregaron. */
export const deliveredCount = (order: Pick<Order, 'items'>): number =>
  order.items.filter((item) => item.delivered).length;

/**
 * Hay prendas entregadas y prendas que no.
 *
 * Es lo que el club necesita ver de un vistazo: un pedido a medio entregar
 * sigue abierto aunque ya le hayan dado algo al socio.
 */
export function isPartiallyDelivered(order: Pick<Order, 'items'>): boolean {
  const entregadas = deliveredCount(order);
  return entregadas > 0 && entregadas < order.items.length;
}

/** La línea sale a pedido: hay unidades que el club no tenía físicamente. */
export const isBackordered = (item: Pick<OrderItem, 'backorderedUnits'>): boolean =>
  item.backorderedUnits > 0;

/** Al menos una prenda del pedido sale a pedido. */
export const hasBackorder = (order: Pick<Order, 'items'>): boolean =>
  order.items.some(isBackordered);

/**
 * La variante de una línea: `M · Roja`, o sólo `M` si el producto no tiene
 * colores.
 *
 * Estaba escrito por separado en el dominio, en la plantilla de mail y en el
 * JSX del panel. Los tres daban el mismo texto por casualidad, no porque algo
 * lo garantizara. El Excel queda afuera a propósito: ahí talle y color son
 * columnas separadas porque el club filtra y ordena por cada una.
 */
export const variantLabel = (item: Pick<OrderItem, 'size' | 'color'>): string =>
  [item.size, item.color].filter(Boolean).join(' · ');

/** Etiqueta de una línea para tablas y CSV: "2× Remera (M · Roja)". */
export const describeItem = (item: OrderItem): string =>
  `${item.quantity}× ${item.productName} (${variantLabel(item)})`;
