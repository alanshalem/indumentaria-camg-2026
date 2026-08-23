/**
 * Manda un mail de prueba con datos inventados, usando exactamente el mismo
 * camino que un pedido real: misma plantilla, mismo transporte, misma config.
 *
 * Existe para poder verificar la configuración de Resend y del dominio sin
 * tener que generar un pedido falso que después ensucie el panel.
 *
 *   npm run email:test -- socio@ejemplo.com
 *   npm run email:test -- socio@ejemplo.com readyForPickup
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getConfig } from '../server/config/env.js';
import { CLUB, missingClubInfo } from '../shared/domain/club.js';
import { resendTransport } from '../server/infra/emailTransport.js';
import { renderOrderEmail } from '../server/modules/emails/templates/index.js';
import type { Order } from '../shared/domain/order.js';
import { EMAIL_KINDS, type EmailKind } from '../shared/domain/orderEmails.js';

/** Mismo parseo que scripts/db.mjs: el backend lee process.env, no import.meta. */
function loadEnvFile(name: string): void {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key!]) continue;
    process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, '');
  }
}

const sampleOrder = (email: string): Order => ({
  code: 'CAMG-2026-PRUEBA',
  timestamp: Date.now(),
  customerName: 'Prueba',
  customerLastName: 'De Envío',
  phone: '1123456789',
  email,
  items: [
    {
      productId: 'buzo-medio-cierre',
      productName: 'Buzo Medio Cierre CAMG',
      size: 'L',
      sizeTier: 'large',
      color: null,
      quantity: 1,
      unitPrice: 45500,
    },
    {
      productId: 'pantalon-con-cierre',
      productName: 'Pantalón con cierre CAMG',
      size: 'L',
      sizeTier: 'large',
      color: null,
      quantity: 1,
      unitPrice: 48500,
    },
  ],
  subtotal: 94000,
  promotions: [
    {
      id: 'combo-buzo-pantalon',
      kind: 'combo',
      label: 'Combo buzo ½ cierre + pantalón',
      detail: 'Buzo Medio Cierre CAMG (L) + Pantalón con cierre CAMG (L)',
      amount: 9000,
    },
  ],
  total: 85000,
  status: 'pending',
});

// ---------------------------------------------------------------------------

loadEnvFile('.env.local');
loadEnvFile('.env');

const [recipient, requestedKind = 'orderReceived'] = process.argv.slice(2);

if (!recipient || !recipient.includes('@')) {
  console.error('\nUso: npm run email:test -- tu@mail.com [orderReceived|paymentConfirmed|readyForPickup]\n');
  process.exit(1);
}

if (!EMAIL_KINDS.includes(requestedKind as EmailKind)) {
  console.error(`\nTipo desconocido: ${requestedKind}. Opciones: ${EMAIL_KINDS.join(', ')}\n`);
  process.exit(1);
}

const kind = requestedKind as EmailKind;
const { email } = getConfig();
const order = sampleOrder(recipient);
const rendered = renderOrderEmail(kind, { order, email });

console.log('\nMail de prueba');
console.log(`  tipo ......... ${kind}`);
console.log(`  de ........... ${email.from}`);
console.log(`  para ......... ${recipient}`);
console.log(`  responder a .. ${email.replyTo ?? '(sin reply-to)'}`);
console.log(`  logo ......... ${email.siteUrl}/images/logo-camg-email.png`);
console.log(`  asunto ....... ${rendered.subject}`);

const faltantes = missingClubInfo();
if (faltantes.length > 0) {
  console.log(`\n  ⚠ sin cargar en shared/domain/club.ts: ${faltantes.join(', ')}`);
  console.log('    Esos recuadros no van a salir en el mail.');
} else {
  console.log(`  club ......... ${CLUB.name} · alias ${CLUB.paymentAlias}`);
}

const result = await resendTransport.send({
  to: recipient,
  subject: rendered.subject,
  html: rendered.html,
  text: rendered.text,
});

console.log();
if (result.status === 'sent') {
  console.log(`✓ Enviado. Id de Resend: ${result.providerId ?? '(sin id)'}`);
  console.log('  Si no llega en unos minutos, mirá spam y el panel de Resend → Logs.\n');
} else if (result.status === 'skipped') {
  console.log(`— Omitido: ${result.reason}\n`);
  process.exit(1);
} else {
  console.log(`✗ Falló: ${result.error}`);
  console.log('  403 suele ser el dominio sin verificar en Resend.');
  console.log('  422 suele ser un EMAIL_FROM con un dominio que no es el verificado.\n');
  process.exit(1);
}
