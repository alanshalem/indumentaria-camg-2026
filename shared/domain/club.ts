/**
 * Datos del club, en un solo lugar.
 *
 * Están acá y no en variables de entorno a propósito: nada de esto es secreto
 * —el alias y la dirección salen impresos en cada mail que recibe un socio— y
 * como env vars fallaban en silencio: si alguna faltaba en Vercel, el mail se
 * mandaba igual pero sin decir cómo pagar, y nadie se enteraba.
 *
 * Para cambiar cualquiera de estos datos: editás acá y deployás. Cambian una o
 * dos veces por año, así que no justifica una tabla en la base ni una pantalla
 * de configuración.
 *
 * Un campo vacío (`''`) NO rompe nada: el mail omite ese recuadro entero en
 * vez de mostrar una etiqueta sin valor.
 */
export interface ClubInfo {
  /** Nombre completo, para encabezados y firmas. */
  name: string;
  shortName: string;
  /** Alias de transferencia. Va en el mail de "recibimos tu pedido". */
  paymentAlias: string;
  /** Dónde se retira el pedido. */
  pickupAddress: string;
  /** Días y horarios de retiro. */
  pickupHours: string;
  /** WhatsApp de contacto del club. */
  contactPhone: string;
  instagram: string;
  instagramUrl: string;
}

export const CLUB: ClubInfo = {
  name: 'Club Atlético Monte Grande',
  shortName: 'CAMG',

  // TODO(club): completar con los datos reales antes de mandar el primer mail.
  paymentAlias: '',
  pickupAddress: '',
  pickupHours: '',
  contactPhone: '',

  instagram: '@clubatleticomontegrande',
  instagramUrl: 'https://instagram.com/clubatleticomontegrande',
};

/** Qué datos faltan cargar. Lo usa `npm run email:test` para avisar. */
export const missingClubInfo = (club: ClubInfo = CLUB): string[] =>
  (
    [
      ['alias de pago', club.paymentAlias],
      ['dirección de retiro', club.pickupAddress],
      ['horarios de retiro', club.pickupHours],
      ['teléfono de contacto', club.contactPhone],
    ] as const
  )
    .filter(([, value]) => value.trim().length === 0)
    .map(([label]) => label);
