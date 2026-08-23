import { ORDER_STATUS_LABELS } from '@shared/domain/order';
import { EMAIL_KIND_LABELS, type EmailKind } from '@shared/domain/orderEmails';
import type { OrderStatusUpdate } from '@shared/api/contracts';

const listKinds = (kinds: readonly EmailKind[]): string =>
  kinds.map((kind) => `"${EMAIL_KIND_LABELS[kind]}"`).join(' y ');

/**
 * Qué decirle al admin después de mover el estado.
 *
 * Antes no se decía nada: un estado que no manda mail se veía igual que un
 * envío que falló, y la única forma de distinguirlos era mirar la base.
 */
export function describeUpdate({ order, notice, missed }: OrderStatusUpdate): {
  tone: 'success' | 'error';
  text: string;
} {
  const head = `${order.code} → ${ORDER_STATUS_LABELS[order.status]}.`;
  // Sólo se menciona lo que quedó sin mandar de etapas ya pasadas: lo que
  // todavía no corresponde no es un problema.
  const tail = missed.length > 0 ? ` Ojo: nunca se le mandó ${listKinds(missed)}.` : '';

  if (!notice) return { tone: 'success', text: `${head} Este estado no manda ningún aviso.${tail}` };

  switch (notice.status) {
    case 'sent':
      return { tone: 'success', text: `${head} Le mandamos ${listKinds([notice.kind])} a ${notice.recipient}.${tail}` };
    case 'already':
      return {
        tone: 'success',
        text: `${head} ${listKinds([notice.kind])} ya se le había mandado, no se repite.${tail}`,
      };
    default:
      return {
        tone: 'error',
        text: `${head} No salió ${listKinds([notice.kind])}: ${notice.reason ?? 'error desconocido'}`,
      };
  }
}
