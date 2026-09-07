const NON_DIGITS = /\D+/g;

export const MIN_PHONE_DIGITS = 8;
export const MAX_PHONE_DIGITS = 15;

/** Deja sólo dígitos: "(011) 4567-8901" → "01145678901". */
export const normalizePhone = (value: string): string => value.replace(NON_DIGITS, '');

export const isValidPhone = (value: string): boolean => {
  const digits = normalizePhone(value);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
};

/** Un celular argentino reconocido, ya sin prefijos de marcación. */
export interface ArgentineMobile {
  /** Código de área. Hoy siempre "11": el club es de Monte Grande. */
  area: string;
  /** Los 8 dígitos del abonado. */
  subscriber: string;
}

/**
 * Reconoce un celular de Buenos Aires escrito de cualquiera de las formas en
 * que la gente lo tipea: "1162788263", "011 15 6278-8263", "+54 9 11 6278 8263".
 *
 * Sólo entiende el área 11, que es la de todos los socios del club. Cubrir el
 * resto del país pediría una tabla de códigos de área de 2, 3 y 4 dígitos, y
 * adivinar dónde corta sin esa tabla es cómo se arruina un teléfono.
 * Un número que no encaja devuelve `null` y se muestra tal como vino.
 */
export function parseArgentineMobile(value: string): ArgentineMobile | null {
  let digits = normalizePhone(value);

  // Prefijos de marcación, en el orden en que aparecen: país, celular, larga
  // distancia. Se sacan sólo si sobran dígitos, para no comerse parte del área.
  if (digits.startsWith('54') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('9') && digits.length > 10) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = digits.slice(1);

  // El viejo "15" va después del área: 011 15 6278-8263.
  if (digits.startsWith('1115') && digits.length === 12) digits = `11${digits.slice(4)}`;

  if (digits.startsWith('11') && digits.length === 10) {
    return { area: '11', subscriber: digits.slice(2) };
  }

  return null;
}

/**
 * Formato para el panel, el Excel y cualquier lugar donde alguien lo vaya a
 * copiar: `+54 9 11 6278-8263`. Es el número completo, listo para pegar en
 * WhatsApp sin tener que agregarle nada.
 *
 * Si no se reconoce, se devuelve tal cual: mejor un número raro que uno
 * inventado.
 */
export function formatPhone(value: string): string {
  const mobile = parseArgentineMobile(value);
  if (!mobile) return value.trim();

  const { area, subscriber } = mobile;
  return `+54 9 ${area} ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
}

/** Link de WhatsApp para contactar al socio desde el panel. */
export function whatsappLink(value: string): string {
  const mobile = parseArgentineMobile(value);
  if (mobile) return `https://wa.me/549${mobile.area}${mobile.subscriber}`;

  // Sin reconocer: se manda lo que hay con el país adelante, que es lo que
  // hacía antes y a veces igual funciona.
  const digits = normalizePhone(value);
  const withCountry = digits.startsWith('54') ? digits : `54${digits.replace(/^0/, '')}`;
  return `https://wa.me/${withCountry}`;
}
