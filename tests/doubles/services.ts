import type { OrderStatus } from '../../shared/domain/order';
import { emailKindForStatus, type EmailKind } from '../../shared/domain/orderEmails';
import type { EmailMessage, EmailTransport, SendResult } from '../../server/infra/emailTransport';
import type { EmailsService } from '../../server/modules/emails/emails.service';

/**
 * Dobles de las dependencias que salen a la red.
 *
 * El transporte de mails es el borde del sistema: todo test que lo use quiere
 * leer qué mensaje se armó, nunca mandarlo. `result` permite ensayar un Resend
 * caído sin tocar Resend.
 */
export function fakeTransport(result: SendResult = { status: 'sent', providerId: 're_1' }) {
  const sent: EmailMessage[] = [];
  const transport: EmailTransport = {
    send: async (message) => {
      sent.push(message);
      return result;
    },
  };
  return { transport, sent };
}

/**
 * Espía del servicio de mails: registra a qué estado se le avisó, sin armar
 * ninguna plantilla. Es lo que necesitan los tests de pedidos, que les importa
 * *si* se avisó y no *qué* decía.
 */
export function fakeEmails(missed: EmailKind[] = []): EmailsService & { notified: OrderStatus[] } {
  const notified: OrderStatus[] = [];
  return {
    notified,
    notifyStatus: async (order) => {
      notified.push(order.status);
      const kind = emailKindForStatus(order.status);
      return kind ? { kind, status: 'sent', recipient: order.email ?? '' } : null;
    },
    missedNotices: async () => missed,
    history: async () => [],
    preview: async () => {
      throw new Error('no usado');
    },
  };
}
