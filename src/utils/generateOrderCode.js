import { nextCounter } from './storage';

export function generateOrderCode() {
  const year = new Date().getFullYear();
  const n = nextCounter();
  const padded = String(n).padStart(5, '0');
  return `CAMG-${year}-${padded}`;
}
