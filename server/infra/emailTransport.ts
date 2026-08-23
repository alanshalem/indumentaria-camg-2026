import { getConfig } from '../config/env.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { status: 'sent'; providerId: string | null }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

export interface EmailTransport {
  send(message: EmailMessage): Promise<SendResult>;
}

/**
 * Resend por su API REST, sin el SDK.
 *
 * Es un solo POST: el SDK sería una dependencia más para bundlear en la Function
 * a cambio de nada. Además nunca lanza — devuelve el resultado — porque un mail
 * que no sale no puede tumbar un pedido que sí se guardó.
 */
export const resendTransport: EmailTransport = {
  async send(message) {
    const { email } = getConfig();

    if (!email.apiKey) {
      return { status: 'skipped', reason: 'Falta RESEND_API_KEY: no se configuró el envío de mails.' };
    }

    // Sin timeout, un proveedor lento deja colgada la respuesta del checkout.
    const abort = AbortSignal.timeout(TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${email.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: email.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: abort,
      });

      const body = (await response.json().catch(() => null)) as
        | { id?: string; message?: string; name?: string }
        | null;

      if (!response.ok) {
        return {
          status: 'failed',
          error: body?.message ?? `Resend respondió ${response.status}.`,
        };
      }

      return { status: 'sent', providerId: body?.id ?? null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { status: 'failed', error: `No se pudo contactar a Resend: ${reason}` };
    }
  },
};
