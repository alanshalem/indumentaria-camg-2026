import { getConfig } from '../../config/env.js';
import type { Order } from '../../../shared/domain/order.js';
import { emailKindForStatus, type EmailKind } from '../../../shared/domain/orderEmails.js';
import {
  emailLogRepository,
  type EmailLogRepository,
} from '../../infra/emailLogRepository.js';
import { resendTransport, type EmailTransport } from '../../infra/emailTransport.js';
import { renderOrderEmail } from './templates/index.js';

export interface EmailsService {
  /** Manda el aviso que corresponde al estado, si es que hay uno. */
  notifyStatus(order: Order): Promise<void>;
}

export function createEmailsService(
  transport: EmailTransport = resendTransport,
  log: EmailLogRepository = emailLogRepository,
): EmailsService {
  return {
    async notifyStatus(order) {
      const kind = emailKindForStatus(order.status);
      if (!kind) return;
      await send(order, kind, transport, log);
    },
  };
}

/**
 * Un mail nunca puede tumbar la operación que lo disparó.
 *
 * El pedido ya se guardó y el cambio de estado ya se aplicó cuando llegamos
 * acá: si Resend está caído, se registra el fallo y se sigue. Es preferible un
 * socio sin aviso a un pedido perdido.
 */
async function send(
  order: Order,
  kind: EmailKind,
  transport: EmailTransport,
  log: EmailLogRepository,
): Promise<void> {
  try {
    if (!order.email) {
      // Pedidos viejos, de cuando el mail era opcional.
      await log.record({
        orderCode: order.code,
        kind,
        recipient: '',
        status: 'skipped',
        error: 'El pedido no tiene email de contacto.',
      });
      return;
    }

    // Idempotencia: si el admin mueve el estado de ida y vuelta, el socio no
    // recibe el mismo aviso dos veces.
    if (await log.wasSent(order.code, kind)) return;

    const { email } = getConfig();
    const rendered = renderOrderEmail(kind, { order, email });

    const result = await transport.send({
      to: order.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (result.status === 'sent') {
      await log.record({
        orderCode: order.code,
        kind,
        recipient: order.email,
        status: 'sent',
        providerId: result.providerId,
      });
      return;
    }

    const reason = result.status === 'skipped' ? result.reason : result.error;
    console.warn(`[email] ${kind} para ${order.code}: ${reason}`);
    await log.record({
      orderCode: order.code,
      kind,
      recipient: order.email,
      status: result.status,
      error: reason,
    });
  } catch (error) {
    console.error(`[email] fallo inesperado enviando ${kind} de ${order.code}:`, error);
  }
}

export const emailsService = createEmailsService();
