import { getConfig } from '../../config/env.js';
import type { Order } from '../../../shared/domain/order.js';
import {
  emailKindForStatus,
  missedNoticeKinds,
  type EmailKind,
  type EmailNotice,
} from '../../../shared/domain/orderEmails.js';
import {
  emailLogRepository,
  type EmailLogRecord,
  type EmailLogRepository,
} from '../../infra/emailLogRepository.js';
import { resendTransport, type EmailTransport } from '../../infra/emailTransport.js';
import { renderOrderEmail } from './templates/index.js';

export interface EmailsService {
  /**
   * Manda el aviso que corresponde al estado. Devuelve qué pasó —o `null` si
   * ese estado no dispara ninguno— para que el panel lo pueda mostrar.
   */
  notifyStatus(order: Order): Promise<EmailNotice | null>;
  /** Avisos de etapas ya superadas que este pedido nunca recibió. */
  missedNotices(order: Order): Promise<EmailKind[]>;
  /** Historial completo, para que el panel pueda mostrar qué se le mandó. */
  history(orderCode: string): Promise<EmailLogRecord[]>;
}

export function createEmailsService(
  transport: EmailTransport = resendTransport,
  log: EmailLogRepository = emailLogRepository,
): EmailsService {
  return {
    async notifyStatus(order) {
      const kind = emailKindForStatus(order.status);
      if (!kind) return null;
      return send(order, kind, transport, log);
    },

    history: (orderCode) => log.history(orderCode),

    async missedNotices(order) {
      try {
        return missedNoticeKinds(order.status, await log.sentKinds(order.code));
      } catch (error) {
        // Es información de cortesía para el panel: si la base no responde,
        // el cambio de estado no se cae por eso.
        console.error(`[email] no se pudo leer el historial de ${order.code}:`, error);
        return [];
      }
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
): Promise<EmailNotice> {
  try {
    if (!order.email) {
      // Pedidos viejos, de cuando el mail era opcional.
      const reason = 'El pedido no tiene email de contacto.';
      await log.record({ orderCode: order.code, kind, recipient: '', status: 'skipped', error: reason });
      return { kind, status: 'skipped', recipient: '', reason };
    }

    // Idempotencia: si el admin mueve el estado de ida y vuelta, el socio no
    // recibe el mismo aviso dos veces.
    if ((await log.sentKinds(order.code)).includes(kind)) {
      return { kind, status: 'already', recipient: order.email };
    }

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
      return { kind, status: 'sent', recipient: order.email };
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
    return { kind, status: result.status, recipient: order.email, reason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[email] fallo inesperado enviando ${kind} de ${order.code}:`, error);
    return { kind, status: 'failed', recipient: order.email ?? '', reason };
  }
}

export const emailsService = createEmailsService();
