/**
 * Cómo paga el socio.
 *
 * Lo registra el club, no el socio: el flujo real es que el pedido se genera y
 * después el club lo contacta para cobrarlo. Hasta que eso pasa, el método es
 * `null` y la tabla lo muestra como pendiente de definir.
 */
export const PAYMENT_METHODS = ['cash', 'mercadopago'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  mercadopago: 'Mercado Pago',
};

/** Etiqueta corta para la tabla, con el caso "todavía no se sabe". */
export const paymentMethodLabel = (method: PaymentMethod | null): string =>
  method ? PAYMENT_METHOD_LABELS[method] : 'Sin definir';

export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);

/** Mercado Pago cobra con un link; el efectivo se paga en la sede. */
export const needsPaymentLink = (method: PaymentMethod | null): boolean =>
  method === 'mercadopago';
