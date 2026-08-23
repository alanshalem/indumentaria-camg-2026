import type { OrderStatus } from './order.js';

/**
 * Mails transaccionales del pedido.
 *
 * El `kind` es la clave de idempotencia: la base tiene un índice único por
 * (pedido, kind) sobre los envíos exitosos, así que aunque el admin vuelva a
 * mover el estado de ida y vuelta, el socio recibe cada aviso una sola vez.
 */
export const EMAIL_KINDS = ['orderReceived', 'paymentConfirmed', 'readyForPickup'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  orderReceived: 'Recibimos tu pedido',
  paymentConfirmed: 'Confirmamos tu pago',
  readyForPickup: 'Listo para retirar',
};

/**
 * Qué mail dispara cada estado. `delivered` no manda nada: la persona ya se
 * llevó la prenda, un mail después del hecho es sólo ruido.
 */
export const EMAIL_FOR_STATUS: Partial<Record<OrderStatus, EmailKind>> = {
  pending: 'orderReceived',
  paid: 'paymentConfirmed',
  ready: 'readyForPickup',
};

export const emailKindForStatus = (status: OrderStatus): EmailKind | null =>
  EMAIL_FOR_STATUS[status] ?? null;
