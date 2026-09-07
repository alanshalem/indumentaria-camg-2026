import { ROUTES, type EmailPreview } from '@shared/api/contracts';
import type { EmailKind } from '@shared/domain/orderEmails';
import { httpClient } from './httpClient';

export const emailService = {
  /**
   * Renderiza una plantilla sin mandar nada. Sin `code` usa el pedido de
   * ejemplo; con uno real, muestra exactamente lo que le llegaría a ese socio.
   */
  preview: (kind: EmailKind, code?: string) =>
    httpClient.get<EmailPreview>(ROUTES.emails.preview, { query: { kind, code } }),
};
