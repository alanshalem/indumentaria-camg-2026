import { CLUB } from '../../../../shared/domain/club.js';
import { formatPrice } from '../../../../shared/domain/money.js';
import {
  countOrderUnits,
  isBackordered,
  variantLabel,
  type Order,
} from '../../../../shared/domain/order.js';
import { ON_DEMAND_NOTICE } from '../../../../shared/domain/stock.js';

/**
 * Piezas para armar los mails.
 *
 * Todo es HTML de tabla con estilos inline a propósito: Outlook no soporta
 * flex ni grid y descarta la mayoría de los `<style>`. Es feo de escribir pero
 * es lo único que se ve igual en Gmail, Outlook y Apple Mail.
 */

const COLOR = {
  page: '#f4f4f5',
  card: '#ffffff',
  header: '#0e0e0e',
  red: '#dc143c',
  ink: '#1f2937',
  muted: '#6b7280',
  line: '#e5e7eb',
  soft: '#f9fafb',
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Los datos vienen de lo que tipeó el socio y del catálogo. Sin escapar, un
 * nombre con `<` rompe el mail —o peor, inyecta markup en la casilla ajena.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  preheader: string;
  siteUrl: string;
  body: string;
  footerNote?: string;
}

export function layout({ preheader, siteUrl, body, footerNote }: LayoutOptions): string {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Club Atlético Monte Grande</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};-webkit-text-size-adjust:100%;">
  <!-- Línea de vista previa: es lo que se lee en la bandeja antes de abrir. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

          <tr>
            <td align="center" style="background:${COLOR.header};border-radius:12px 12px 0 0;padding:28px 24px 22px;">
              <img src="${siteUrl}/images/logo-camg-email.png" width="72" height="72" alt="Club Atlético Monte Grande"
                   style="display:block;border:0;width:72px;height:72px;" />
              <div style="font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a9a9a;padding-top:12px;">
                Club Atlético
              </div>
              <div style="font-family:${FONT};font-size:19px;font-weight:700;color:#ffffff;padding-top:2px;">
                Monte Grande
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.card};padding:32px 28px;font-family:${FONT};color:${COLOR.ink};">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.soft};border-radius:0 0 12px 12px;border-top:1px solid ${COLOR.line};padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">
              ${footerNote ? `<p style="margin:0 0 10px;">${footerNote}</p>` : ''}
              <p style="margin:0;">${escapeHtml(CLUB.name)} · Indumentaria oficial · Temporada ${year}</p>
              ${/* Los mails son de sólo ida: el From no tiene buzón y las
                    respuestas rebotan. Por eso el pie manda al WhatsApp. */ ''}
              <p style="margin:6px 0 0;">
                Este mail se envía automáticamente, no respondas a esta dirección.${
                  CLUB.contactPhone
                    ? ` Si tenés dudas, escribinos al WhatsApp ${escapeHtml(CLUB.contactPhone)}.`
                    : ''
                }
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
//  Bloques
// ---------------------------------------------------------------------------

/**
 * Convencion de estos helpers, para no escapar dos veces:
 *  - los que reciben `text` escapan ellos (pasales texto crudo)
 *  - los que reciben `html` NO escapan (escapa vos lo que interpoles)
 */
export const heading = (text: string): string =>
  `<h1 style="margin:0 0 6px;font-family:${FONT};font-size:23px;line-height:1.25;font-weight:800;color:${COLOR.ink};">${escapeHtml(text)}</h1>`;

export const paragraph = (html: string): string =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${COLOR.ink};">${html}</p>`;

export const muted = (html: string): string =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLOR.muted};">${html}</p>`;

/** El código es lo que le van a pedir al retirar: va grande y aislado. */
export const codeBlock = (code: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td align="center" style="background:${COLOR.soft};border:1px dashed ${COLOR.line};border-radius:10px;padding:18px;">
      <div style="font-family:${FONT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.muted};">
        Código de pedido
      </div>
      <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:2px;color:${COLOR.red};padding-top:6px;">
        ${escapeHtml(code)}
      </div>
    </td>
  </tr>
</table>`;

/** Botón principal del mail. Con fallback: si no carga el estilo, sigue siendo un link. */
export const button = (label: string, href: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td align="center" style="background:${COLOR.red};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;

/** Recuadro de datos: alias para transferir, dirección de retiro, etc. */
export const infoBox = (title: string, rows: readonly (readonly [string, string])[]): string => {
  const visible = rows.filter(([, value]) => value.trim().length > 0);
  if (visible.length === 0) return '';

  const cells = visible
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:3px 0;font-family:${FONT};font-size:13px;color:${COLOR.muted};white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:3px 0 3px 14px;font-family:${FONT};font-size:14px;font-weight:600;color:${COLOR.ink};">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('');

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td style="background:${COLOR.soft};border-left:3px solid ${COLOR.red};border-radius:0 8px 8px 0;padding:16px 18px;">
      <div style="font-family:${FONT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.muted};padding-bottom:8px;">
        ${escapeHtml(title)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${cells}</table>
    </td>
  </tr>
</table>`;
};

/** Detalle del pedido: una fila por prenda, más subtotal, promos y total. */
export function itemsTable(order: Order): string {
  const rows = order.items
    .map((item) => {
      const detail = variantLabel(item);
      // La prenda que salió a pedido lo dice en su propia línea: el socio ve
      // el plazo pegado a lo que lo tiene esperando, no en una nota al pie.
      const aPedido = isBackordered(item)
        ? `<br /><span style="font-size:12px;color:${COLOR.red};font-weight:600;">${escapeHtml(ON_DEMAND_NOTICE)}</span>`
        : '';

      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLOR.line};font-family:${FONT};font-size:14px;color:${COLOR.ink};">
          <strong style="font-weight:600;">${escapeHtml(item.productName)}</strong><br />
          <span style="font-size:12px;color:${COLOR.muted};">Talle ${escapeHtml(detail)}</span>${aPedido}
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid ${COLOR.line};font-family:${FONT};font-size:14px;color:${COLOR.muted};white-space:nowrap;">
          ×${item.quantity}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLOR.line};font-family:${FONT};font-size:14px;color:${COLOR.ink};white-space:nowrap;">
          ${formatPrice(item.unitPrice * item.quantity)}
        </td>
      </tr>`;
    })
    .join('');

  const promotions = order.promotions
    .map(
      (promotion) => `
      <tr>
        <td colspan="2" style="padding:6px 0;font-family:${FONT};font-size:13px;color:#166534;">
          ${escapeHtml(promotion.label)}
        </td>
        <td align="right" style="padding:6px 0;font-family:${FONT};font-size:13px;font-weight:600;color:#166534;white-space:nowrap;">
          −${formatPrice(promotion.amount)}
        </td>
      </tr>`,
    )
    .join('');

  const subtotalRow = order.promotions.length
    ? `<tr>
        <td colspan="2" style="padding:12px 0 6px;font-family:${FONT};font-size:13px;color:${COLOR.muted};">Subtotal</td>
        <td align="right" style="padding:12px 0 6px;font-family:${FONT};font-size:13px;color:${COLOR.muted};white-space:nowrap;">${formatPrice(order.subtotal)}</td>
      </tr>`
    : '';

  const units = countOrderUnits(order.items);

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
  <tr>
    <td colspan="3" style="padding-bottom:6px;font-family:${FONT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.muted};border-bottom:2px solid ${COLOR.ink};">
      Tu pedido · ${units} ${units === 1 ? 'prenda' : 'prendas'}
    </td>
  </tr>
  ${rows}
  ${subtotalRow}
  ${promotions}
  <tr>
    <td colspan="2" style="padding:14px 0 0;font-family:${FONT};font-size:15px;font-weight:700;color:${COLOR.ink};">Total</td>
    <td align="right" style="padding:14px 0 0;font-family:${FONT};font-size:20px;font-weight:800;color:${COLOR.red};white-space:nowrap;">
      ${formatPrice(order.total)}
    </td>
  </tr>
</table>`;
}

/** Versión de texto plano del detalle, para clientes que no muestran HTML. */
export function itemsText(order: Order): string {
  const lines = order.items.flatMap((item) => {
    const detail = [item.size, item.color].filter(Boolean).join(' · ');
    const linea = `  ${item.quantity}x ${item.productName} (${detail}) — ${formatPrice(item.unitPrice * item.quantity)}`;
    return isBackordered(item) ? [linea, `     ${ON_DEMAND_NOTICE}`] : [linea];
  });

  if (order.promotions.length > 0) {
    lines.push(`  Subtotal: ${formatPrice(order.subtotal)}`);
    for (const promotion of order.promotions) {
      lines.push(`  ${promotion.label}: −${formatPrice(promotion.amount)}`);
    }
  }
  lines.push(`  TOTAL: ${formatPrice(order.total)}`);
  return lines.join('\n');
}
