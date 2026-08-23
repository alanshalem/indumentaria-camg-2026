import type { EmailConfig } from '../../../config/env.js';
import { formatPrice } from '../../../../shared/domain/money.js';
import { CLUB } from '../../../../shared/domain/club.js';
import type { Order } from '../../../../shared/domain/order.js';
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

/** Link firmado al seguimiento. Sólo lo puede armar el servidor. */
const statusLink = (order: Order, siteUrl: string) =>
  `${siteUrl}${PAGES.orderStatus(order.code, signOrderToken(order.code))}`;

const firstName = (order: Order) => order.customerName.trim().split(/\s+/)[0] ?? order.customerName;

/** Pie común: cómo identificarse al retirar. */
const PICKUP_NOTE = 'Guardá el código: te lo van a pedir en la sede al momento de retirar.';

// ---------------------------------------------------------------------------
//  1 · Pedido recibido (estado: pendiente de pago)
// ---------------------------------------------------------------------------

const orderReceived: Template = ({ order, email, club = CLUB }) => {
  const payment = club.paymentAlias
    ? infoBox('Cómo pagar', [
        ['Alias', club.paymentAlias],
        ['Importe', formatPrice(order.total)],
        ['Referencia', order.code],
      ])
    : '';

  const paymentHint = club.paymentAlias
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
        // El recuadro va primero: el texto lo referencia como "el alias de arriba".
        payment,
        paymentHint,
        button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
        muted(PICKUP_NOTE),
      ].join('\n'),
      footerNote: 'Recibiste este mail porque generaste un pedido en la tienda del club.',
    }),
    text: [
      `¡Gracias, ${firstName(order)}!`,
      '',
      'Recibimos tu pedido de indumentaria del club. Todavía no está confirmado: falta el pago.',
      '',
      `CÓDIGO DE PEDIDO: ${order.code}`,
      '',
      'TU PEDIDO',
      itemsText(order),
      '',
      club.paymentAlias
        ? `Para confirmarlo, transferí ${formatPrice(order.total)} al alias ${club.paymentAlias} usando ${order.code} como referencia.`
        : 'En breve te contactamos por WhatsApp para pasarte los datos de pago.',
      '',
      `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
      '',
      PICKUP_NOTE,
    ].join('\n'),
  };
};

// ---------------------------------------------------------------------------
//  2 · Pago confirmado
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
      button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
      infoBox('Consultas', [
        ['WhatsApp', club.contactPhone],
        ['Referencia', order.code],
      ]),
      muted(PICKUP_NOTE),
    ].join('\n'),
  }),
  text: [
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
    `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
    '',
    PICKUP_NOTE,
  ].join('\n'),
});

// ---------------------------------------------------------------------------
//  3 · Listo para retirar
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
      infoBox('Dónde y cuándo', [
        ['Dirección', club.pickupAddress],
        ['Horarios', club.pickupHours],
        ['Consultas', club.contactPhone],
      ]),
      itemsTable(order),
      paragraph('Mostrá el código al retirar. Si va otra persona en tu lugar, alcanza con que lleve el código.'),
      button('Ver el estado de mi pedido', statusLink(order, email.siteUrl)),
    ].join('\n'),
    footerNote: 'Si ya lo retiraste, ignorá este mail.',
  }),
  text: [
    `Ya podés pasar a buscarlo, ${firstName(order)}`,
    '',
    'Tu pedido llegó a la sede del club y está esperándote.',
    '',
    `CÓDIGO DE PEDIDO: ${order.code}`,
    '',
    club.pickupAddress ? `Dirección: ${club.pickupAddress}` : '',
    club.pickupHours ? `Horarios: ${club.pickupHours}` : '',
    '',
    'TU PEDIDO',
    itemsText(order),
    '',
    'Mostrá el código al retirar.',
    '',
    `Seguí tu pedido acá: ${statusLink(order, email.siteUrl)}`,
  ]
    .filter((line) => line !== '')
    .join('\n'),
});

// ---------------------------------------------------------------------------

const TEMPLATES: Record<EmailKind, Template> = {
  orderReceived,
  paymentConfirmed,
  readyForPickup,
};

export const renderOrderEmail = (kind: EmailKind, context: TemplateContext): RenderedEmail =>
  TEMPLATES[kind](context);
