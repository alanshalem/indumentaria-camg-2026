/** Alfabeto sin caracteres ambiguos (0/O, 1/I) para dictar el código por teléfono. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
export const ORDER_CODE_PATTERN = /^CAMG-\d{4}-[A-HJ-NP-Z2-9]{5}$/;

export type RandomInts = (count: number, max: number) => number[];

const mathRandomInts: RandomInts = (count, max) =>
  Array.from({ length: count }, () => Math.floor(Math.random() * max));

/**
 * `randomInts` se inyecta para que el servidor use CSPRNG y los tests un stub
 * determinista. Sin ese seam, esta función sería imposible de testear.
 */
export function generateOrderCode(year: number, randomInts: RandomInts = mathRandomInts): string {
  const suffix = randomInts(CODE_LENGTH, ALPHABET.length)
    .map((n) => ALPHABET[n % ALPHABET.length])
    .join('');
  return `CAMG-${year}-${suffix}`;
}

export const isOrderCode = (value: string): boolean => ORDER_CODE_PATTERN.test(value);
