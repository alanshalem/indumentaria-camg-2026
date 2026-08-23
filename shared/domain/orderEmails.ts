import { ORDER_STATUSES, type OrderStatus } from './order.js';

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

/**
 * Qué pasó con un aviso. El admin lo necesita en el momento del cambio: antes,
 * un estado que no manda nada era indistinguible de un envío que falló en
 * silencio, y la única forma de saberlo era mirar la tabla `email_log`.
 */
export type EmailNoticeStatus = 'sent' | 'already' | 'skipped' | 'failed';

export interface EmailNotice {
  kind: EmailKind;
  status: EmailNoticeStatus;
  recipient: string;
  /** Por qué no salió. Sólo viene en 'skipped' y 'failed'. */
  reason?: string;
}

/**
 * Avisos que correspondían a etapas que el pedido ya pasó y nunca salieron.
 *
 * Es el agujero que deja saltear estados: si el admin marca "Entregado" sin
 * pasar por "Pago confirmado", ese mail no se manda nunca y nadie se entera.
 * Acá se calcula para poder decirlo.
 */
export const missedNoticeKinds = (
  status: OrderStatus,
  sent: readonly EmailKind[],
): EmailKind[] =>
  ORDER_STATUSES.slice(0, ORDER_STATUSES.indexOf(status) + 1)
    .map(emailKindForStatus)
    .filter((kind): kind is EmailKind => kind !== null && !sent.includes(kind));

/** Una línea del historial de avisos, como la lee el panel. */
export interface EmailLogRecord {
  kind: EmailKind;
  status: 'sent' | 'failed' | 'skipped';
  recipient: string;
  error: string | null;
  /** Epoch ms del intento. */
  at: number;
}
