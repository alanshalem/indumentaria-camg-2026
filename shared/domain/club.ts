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
  /**
   * Ventanas de retiro: una entrada por bloque de días con el mismo horario.
   * Es una lista y no un texto con separadores porque el club tiene más de un
   * horario y cada uno se lee mejor en su propio renglón.
   */
  pickupHours: readonly string[];
  /** WhatsApp de contacto del club. */
  contactPhone: string;
  /**
   * Link de cobro de Mercado Pago del club.
   *
   * Es genérico y sin monto: el socio entra y paga lo que le corresponde. Por
   * eso vive acá y no en cada pedido. Un pedido puede igual tener el suyo
   * —con el monto ya cargado— y ese le gana a éste.
   */
  paymentLink: string;
  instagram: string;
  instagramUrl: string;
}

export const CLUB: ClubInfo = {
  name: 'Club Atlético Monte Grande',
  shortName: 'CAMG',

  // TODO(club): falta el alias de transferencia. Hasta que esté, el mail omite
  // ese recuadro en vez de mostrar una etiqueta sin valor.
  paymentAlias: '',

  contactPhone: '+54 9 11 3146-0477',
  paymentLink: 'https://link.mercadopago.com.ar/indumentariacamg',

  pickupAddress: 'Hipólito Yrigoyen 77, Monte Grande, Argentina',
  pickupHours: ['Lunes, miércoles y viernes de 18 a 19', 'Martes y jueves de 17 a 18'],

  instagram: '@clubatleticomontegrande',
  instagramUrl: 'https://instagram.com/clubatleticomontegrande',
};

/** Qué datos faltan cargar. Lo usa `npm run email:test` para avisar. */
export const missingClubInfo = (club: ClubInfo = CLUB): string[] =>
  (
    [
      ['alias de pago', club.paymentAlias.trim().length > 0],
      ['dirección de retiro', club.pickupAddress.trim().length > 0],
      ['horarios de retiro', club.pickupHours.length > 0],
      ['teléfono de contacto', club.contactPhone.trim().length > 0],
      ['link de pago', club.paymentLink.trim().length > 0],
    ] as const
  )
    .filter(([, loaded]) => !loaded)
    .map(([label]) => label);
