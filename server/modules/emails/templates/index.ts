import type { EmailConfig } from '../../../config/env.js';
import { formatPrice } from '../../../../shared/domain/money.js';
import { CLUB, type ClubInfo } from '../../../../shared/domain/club.js';
import { hasBackorder, isBackordered, type Order } from '../../../../shared/domain/order.js';
import { ON_DEMAND_LEAD_TIME } from '../../../../shared/domain/stock.js';
import { MISSING_PAYMENT_LINK, paymentLinkFor } from '../../../../shared/domain/whatsapp.js';
import type { EmailKind } from '../../../../shared/domain/orderEmails.js';
import { PAGES } from '../../../../shared/api/contracts.js';
import { signOrderToken } from '../../../security/orderToken.js';
import {
  button,
  codeBlock,
  escapeHtml,
  heading,
  infoBox,
  itemsTable,
  itemsText,
  layout,
  muted,
  paragraph,
} from './layout.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateContext {
  order: Order;
  email: EmailConfig;
  /** Se puede sobreescribir en los tests; en producción sale de `CLUB`. */
  club?: typeof CLUB;
}

type Template = (context: TemplateContext) => RenderedEmail;

/**
 * Aviso de entrega a pedido, cuando alguna prenda no estaba en stock.
 *
 * Va como bloque aparte además de la marca en cada línea: el socio tiene que
 * enterarse del plazo antes de transferir, no leyendo la letra chica del
 * detalle.
 */
const backorderNotice = (order: Order): string =>
  hasBackorder(order)
    ? infoBox('Entrega', [
        ['Plazo', `A pedido, ${ON_DEMAND_LEAD_TIME}`],
        [
          'Prendas',
          order.items
            .filter(isBackordered)
            .map((item) => `${item.productName} (${item.size})`)
            .join(', '),
        ],
      ])
    : '';

/** Link firmado al seguimiento. Sólo lo puede armar el servidor. */
const statusLink = (order: Order, siteUrl: string) =>
  `${siteUrl}${PAGES.orderStatus(order.code, signOrderToken(order.code))}`;

const firstName = (order: Order) => order.customerName.trim().split(/\s+/)[0] ?? order.customerName;

/** Pie común: cómo identificarse al retirar. */
const PICKUP_NOTE = 'Guardá el código: te lo van a pedir en la sede al momento de retirar.';

/**
 * Dónde y cuándo se retira. Va en los tres mails: el socio lo tiene a mano sin
 * buscar el que llegó primero, y cuando el club cargue el WhatsApp aparece solo.
 *
 * `infoBox` descarta las filas vacías, así que un dato que todavía no está
 * (hoy el WhatsApp) desaparece en vez de dejar una etiqueta huérfana.
 */
const pickupBox = (club: ClubInfo): string =>
  infoBox('Dónde se retira', [
    ['Dirección', club.pickupAddress],
    // Una fila por ventana horaria; la etiqueta va sólo en la primera.
    ...club.pickupHours.map((line, index) => [index === 0 ? 'Horarios' : '', line] as const),
    ['Consultas', club.contactPhone],
  ]);

/** Lo mismo en texto plano. Devuelve sólo los renglones con dato cargado. */
const pickupText = (club: ClubInfo): string[] => [
  ...(club.pickupAddress ? [`Dirección: ${club.pickupAddress}`] : []),
  ...(club.pickupHours.length ? ['Horarios:', ...club.pickupHours.map((line) => `  ${line}`)] : []),
  ...(club.contactPhone ? [`Consultas: ${club.contactPhone}`] : []),
];

/**
 * Une el texto plano colapsando los saltos de más: si un bloque sale vacío
 * porque falta el dato, no deja un hueco doble en el medio del mail.
 */
const plainText = (lines: readonly string[]): string =>
  lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

// ---------------------------------------------------------------------------
//  1 · Pedido recibido (estado: pendiente de pago)
// ---------------------------------------------------------------------------

const orderReceived: Template = ({ order, email, club = CLUB }) => {
  const link = paymentLinkFor(order, club);
  const esMercadoPago = order.paymentMethod === 'mercadopago';
  const esEfectivo = order.paymentMethod === 'cash';

  // El socio ya eligió cómo paga en el checkout: el mail le dice exactamente
  // eso y no "en breve te contactamos", que era lo único que se podía decir
  // cuando el método no se sabía.
  const payment = esMercadoPago
    ? infoBox('Cómo pagar', [
        ['Importe', formatPrice(order.total)],
        ['Referencia', order.code],
      ])
    : club.paymentAlias
      ? infoBox('Cómo pagar', [
          ['Alias', club.paymentAlias],
          ['Importe', formatPrice(order.total)],
          ['Referencia', order.code],
        ])
      : '';

  const paymentHint = esMercadoPago
    ? [
        paragraph(
          `Elegiste pagar con Mercado Pago. Entrá al link, poné <strong>${escapeHtml(formatPrice(order.total))}</strong> y mandanos el comprobante por WhatsApp.`,
        ),
        link === MISSING_PAYMENT_LINK ? '' : button('Pagar con Mercado Pago', link),
      ].join('\n')
    : esEfectivo
      ? paragraph(
          'Elegiste pagar en efectivo en la sede del club. Acercate en los horarios de abajo y cuando lo abones te confirmamos el pedido por mail.',
        )
      : club.paymentAlias
        ? paragraph(
            `Para confirmar el pedido, transferí <strong>${escapeHtml(formatPrice(order.total))}</strong> al alias de arriba y ponés <strong>${escapeHtml(order.code)}</strong> como referencia. Cuando se acredite te avisamos por mail.`,
          )
        : paragraph(
            'En breve te contactamos por WhatsApp para pasarte los datos de pago. Cuando se acredite, te avisamos por mail.',
          );

  return {
    subject: `Recibimos tu pedido ${order.code} · CAMG`,
    html: layout({
      preheader: `Tu pedido por ${formatPrice(order.total)} quedó registrado. Te explicamos cómo pagarlo.`,
      siteUrl: email.siteUrl,
      body: [
        heading(`¡Gracias, ${firstName(order)}!`),
        paragraph('Recibimos tu pedido de indumentaria del club. Todavía no está confirmado: falta el pago.'),
        codeBlock(order.code),
        itemsTable(order),
        // Arriba del pago: que el plazo no sea una sorpresa después de transferir.
        backorderNotice(order),
        // El recuadro va primero: el texto lo referencia como "el alias de arriba".
        payment,
        paymentHint,
        pickupBox(club),
        button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
        muted(PICKUP_NOTE),
      ].join('\n'),
      footerNote: 'Recibiste este mail porque generaste un pedido en la tienda del club.',
    }),
    text: plainText([
      `¡Gracias, ${firstName(order)}!`,
      '',
      'Recibimos tu pedido de indumentaria del club. Todavía no está confirmado: falta el pago.',
      '',
      `CÓDIGO DE PEDIDO: ${order.code}`,
      '',
      'TU PEDIDO',
      itemsText(order),
      '',
      esMercadoPago
        ? `Elegiste Mercado Pago. Pagá ${formatPrice(order.total)} acá: ${link}`
        : esEfectivo
          ? 'Elegiste pagar en efectivo en la sede del club, en los horarios de abajo.'
          : club.paymentAlias
            ? `Para confirmarlo, transferí ${formatPrice(order.total)} al alias ${club.paymentAlias} usando ${order.code} como referencia.`
            : 'En breve te contactamos por WhatsApp para pasarte los datos de pago.',
      '',
      'DÓNDE SE RETIRA',
      ...pickupText(club),
      '',
      `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
      '',
      PICKUP_NOTE,
    ]),
  };
};

// ---------------------------------------------------------------------------
//  2 · Seña recibida (falta completar el pago)
// ---------------------------------------------------------------------------

const depositReceived: Template = ({ order, email, club = CLUB }) => {
  const comoCompletar = club.paymentAlias
    ? paragraph(
        `Para completar el pago, transferí el saldo al alias <strong>${escapeHtml(club.paymentAlias)}</strong> poniendo <strong>${escapeHtml(order.code)}</strong> como referencia.`,
      )
    : paragraph('El club te va a pasar por WhatsApp cuánto falta y cómo completarlo.');

  return {
    subject: `Recibimos tu seña · ${order.code}`,
    html: layout({
      preheader: `Registramos tu seña. El total del pedido es ${formatPrice(order.total)}.`,
      siteUrl: email.siteUrl,
      body: [
        heading(`Recibimos tu seña, ${firstName(order)}`),
        paragraph(
          `Ya quedó registrada. Tu pedido todavía <strong>no está confirmado</strong>: falta completar el pago del total, que es <strong>${escapeHtml(formatPrice(order.total))}</strong>.`,
        ),
        codeBlock(order.code),
        itemsTable(order),
        comoCompletar,
        pickupBox(club),
        button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
        muted(PICKUP_NOTE),
      ].join('\n'),
      footerNote: 'Cuando se acredite el pago completo te avisamos por este mismo medio.',
    }),
    text: plainText([
      `Recibimos tu sena, ${firstName(order)}`,
      '',
      `Ya quedo registrada. Tu pedido todavia NO esta confirmado: falta completar el pago del total, que es ${formatPrice(order.total)}.`,
      '',
      `CODIGO DE PEDIDO: ${order.code}`,
      '',
      'TU PEDIDO',
      itemsText(order),
      '',
      club.paymentAlias
        ? `Para completar el pago, transferi el saldo al alias ${club.paymentAlias} usando ${order.code} como referencia.`
        : 'El club te va a pasar por WhatsApp cuanto falta y como completarlo.',
      '',
      'DONDE SE RETIRA',
      ...pickupText(club),
      '',
      `Segui tu pedido aca: ${statusLink(order, email.siteUrl)}`,
      '',
      PICKUP_NOTE,
    ]),
  };
};

// ---------------------------------------------------------------------------
//  3 · Pago confirmado
// ---------------------------------------------------------------------------

const paymentConfirmed: Template = ({ order, email, club = CLUB }) => ({
  subject: `Confirmamos tu pago · ${order.code}`,
  html: layout({
    preheader: `Recibimos el pago de ${formatPrice(order.total)}. Ya encargamos tu pedido.`,
    siteUrl: email.siteUrl,
    body: [
      heading(`Pago confirmado, ${firstName(order)}`),
      paragraph(
        `Recibimos tu pago de <strong>${escapeHtml(formatPrice(order.total))}</strong>. Tu pedido ya está encargado.`,
      ),
      codeBlock(order.code),
      itemsTable(order),
      paragraph('Te vamos a escribir de nuevo apenas la prenda llegue a la sede y puedas pasar a retirarla.'),
      pickupBox(club),
      button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
      muted(PICKUP_NOTE),
    ].join('\n'),
  }),
  text: plainText([
    `Pago confirmado, ${firstName(order)}`,
    '',
    `Recibimos tu pago de ${formatPrice(order.total)}. Tu pedido ya está encargado.`,
    '',
    `CÓDIGO DE PEDIDO: ${order.code}`,
    '',
    'TU PEDIDO',
    itemsText(order),
    '',
    'Te escribimos de nuevo apenas la prenda llegue a la sede.',
    '',
    'DÓNDE SE RETIRA',
    ...pickupText(club),
    '',
    `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
    '',
    PICKUP_NOTE,
  ]),
});

// ---------------------------------------------------------------------------
//  4 · Listo para retirar
// ---------------------------------------------------------------------------

const readyForPickup: Template = ({ order, email, club = CLUB }) => ({
  subject: `Tu pedido ${order.code} está listo para retirar`,
  html: layout({
    preheader: 'Ya llegó a la sede. Pasá con tu código cuando puedas.',
    siteUrl: email.siteUrl,
    body: [
      heading(`Ya podés pasar a buscarlo, ${firstName(order)}`),
      paragraph('Tu pedido llegó a la sede del club y está esperándote.'),
      codeBlock(order.code),
      pickupBox(club),
      itemsTable(order),
      paragraph('Mostrá el código al retirar. Si va otra persona en tu lugar, alcanza con que lleve el código.'),
      button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
    ].join('\n'),
    footerNote: 'Si ya lo retiraste, ignorá este mail.',
  }),
  text: plainText([
    `Ya podés pasar a buscarlo, ${firstName(order)}`,
    '',
    'Tu pedido llegó a la sede del club y está esperándote.',
    '',
    `CÓDIGO DE PEDIDO: ${order.code}`,
    '',
    'DÓNDE SE RETIRA',
    ...pickupText(club),
    '',
    'TU PEDIDO',
    itemsText(order),
    '',
    'Mostrá el código al retirar.',
    '',
    `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
  ]),
});

// ---------------------------------------------------------------------------

const TEMPLATES: Record<EmailKind, Template> = {
  orderReceived,
  depositReceived,
  paymentConfirmed,
  readyForPickup,
};

export const renderOrderEmail = (kind: EmailKind, context: TemplateContext): RenderedEmail =>
  TEMPLATES[kind](context);
