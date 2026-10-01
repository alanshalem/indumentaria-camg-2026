import { CLUB, type ClubInfo } from './club.js';
import { formatPrice } from './money.js';
import { customerFullName, describeItem, type Order } from './order.js';
import { parseArgentineMobile, normalizePhone } from './phone.js';

/**
 * Mensajes de WhatsApp que el club le manda al socio.
 *
 * No hay API de WhatsApp de por medio: se arma un link `wa.me` con el texto ya
 * escrito y se abre en una pestaña. El club revisa y aprieta enviar. Eso tiene
 * una consecuencia honesta que la UI tiene que respetar: sabemos que el mensaje
 * se **preparó**, no que se haya enviado.
 *
 * Las plantillas viven acá y no en el componente porque son texto de negocio:
 * cambiarlas es editar este archivo, no buscar dentro de un JSX.
 */
export const WHATSAPP_TEMPLATES = ['paymentLink', 'cash'] as const;
export type WhatsappTemplate = (typeof WHATSAPP_TEMPLATES)[number];

export const WHATSAPP_TEMPLATE_LABELS: Record<WhatsappTemplate, string> = {
  paymentLink: 'Link de pago',
  cash: 'Pago en efectivo',
};

export const WHATSAPP_TEMPLATE_HINTS: Record<WhatsappTemplate, string> = {
  paymentLink: 'Manda el link de Mercado Pago y le pide el comprobante.',
  cash: 'Le pasa la dirección y los horarios para pagar en la sede.',
};

/**
 * Una plantilla que el club le preparó al socio.
 *
 * `preparedAt` y no `sentAt`: el sistema sabe que se abrió el chat con el texto
 * escrito, no que alguien haya apretado enviar. La UI dice exactamente eso.
 */
export interface WhatsappLogRecord {
  template: WhatsappTemplate;
  /** Epoch ms. */
  preparedAt: number;
}

/** Marcador que queda a la vista cuando no hay ningún link que mandar. */
export const MISSING_PAYMENT_LINK = '[FALTA CARGAR EL LINK DE PAGO]';

/**
 * Qué link mandarle al socio.
 *
 * El del pedido gana porque, si existe, es uno de Mercado Pago con el monto ya
 * cargado. Si no hay, va el link genérico del club, donde el socio pone el
 * importe a mano. Recién si tampoco está se usa el marcador.
 */
export const paymentLinkFor = (order: Order, club: ClubInfo = CLUB): string =>
  order.paymentLink?.trim() || club.paymentLink.trim() || MISSING_PAYMENT_LINK;

/**
 * El detalle va en renglones y no en una sola línea.
 *
 * Con cuatro prendas, "tu pedido es 2x Remera (12 · Roja), 1x Campera (XL)…"
 * es una pared de texto en el celular. En lista se lee de un vistazo.
 */
const itemLines = (order: Order): string =>
  order.items.map((item) => `• ${describeItem(item)}`).join('\n');

const header = (order: Order): string =>
  [
    `¡Hola ${customerFullName(order)}! Hemos recibido tu pedido.`,
    '',
    `Código de seguimiento: ${order.code}`,
    'Tu pedido:',
    itemLines(order),
    `Total: ${formatPrice(order.total)}`,
  ].join('\n');

const TEMPLATES: Record<WhatsappTemplate, (order: Order, club: ClubInfo) => string> = {
  paymentLink: (order, club) =>
    [
      header(order),
      '',
      `A continuación te dejamos el link de pago: ${paymentLinkFor(order, club)}`,
      '',
      'Enviános el comprobante a este mismo número.',
      'Saludos.',
    ].join('\n'),

  cash: (order, club) =>
    [
      header(order),
      '',
      'El pago es en efectivo, en la sede del club:',
      ...(club.pickupAddress ? [club.pickupAddress] : []),
      ...club.pickupHours,
      '',
      'Cuando lo abones te confirmamos el pedido.',
      'Saludos.',
    ].join('\n'),
};

/**
 * El texto del mensaje, tal como va a quedar en el chat.
 * `club` se puede inyectar: en producción salen de `CLUB`, en los tests no.
 */
export const whatsappMessage = (
  template: WhatsappTemplate,
  order: Order,
  club: ClubInfo = CLUB,
): string => TEMPLATES[template](order, club);

/** No hay ningún link que mandar: ni el del pedido ni el del club. */
export const needsPaymentLink = (
  template: WhatsappTemplate,
  order: Order,
  club: ClubInfo = CLUB,
): boolean => template === 'paymentLink' && paymentLinkFor(order, club) === MISSING_PAYMENT_LINK;

/**
 * Link `wa.me` con el texto adentro. Abrirlo en una pestaña deja el mensaje
 * escrito en el chat del socio, listo para revisar y enviar.
 */
export function whatsappMessageLink(template: WhatsappTemplate, order: Order): string {
  const mobile = parseArgentineMobile(order.phone);
  const phone = mobile ? `549${mobile.area}${mobile.subscriber}` : normalizePhone(order.phone);

  return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(template, order))}`;
}
