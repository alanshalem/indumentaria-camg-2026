const NON_DIGITS = /\D+/g;

export const MIN_PHONE_DIGITS = 8;
export const MAX_PHONE_DIGITS = 15;

/** Deja sólo dígitos: "(011) 4567-8901" → "01145678901". */
export const normalizePhone = (value: string): string => value.replace(NON_DIGITS, '');

export const isValidPhone = (value: string): boolean => {
  const digits = normalizePhone(value);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
};

/**
 * Formato legible para el panel: agrupa como número argentino cuando se puede
 * y, si no, devuelve los dígitos tal cual. Nunca inventa un código de área.
 */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value.trim();
}

/** Link de WhatsApp para contactar al socio desde el panel. */
export function whatsappLink(value: string): string {
  const digits = normalizePhone(value);
  const withCountry = digits.startsWith('54') ? digits : `54${digits.replace(/^0/, '')}`;
  return `https://wa.me/${withCountry}`;
}
