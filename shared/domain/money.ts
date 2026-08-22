/**
 * Dinero del dominio: pesos argentinos enteros.
 * ARS no opera con centavos en la práctica, así que el entero es la unidad
 * canónica y evita los errores de redondeo de punto flotante.
 */
export type Ars = number;

export const MAX_PRICE_ARS = 10_000_000;

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatPrice(value: Ars | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return arsFormatter.format(value);
}

export function isValidPrice(value: unknown): value is Ars {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PRICE_ARS;
}
