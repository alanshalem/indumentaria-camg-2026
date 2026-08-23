import type { EmailKind } from '../../shared/domain/orderEmails.js';
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'email_log';
const UNIQUE_VIOLATION = '23505';

export type EmailLogStatus = 'sent' | 'failed' | 'skipped';

export interface EmailLogEntry {
  orderCode: string;
  kind: EmailKind;
  recipient: string;
  status: EmailLogStatus;
  providerId?: string | null;
  error?: string | null;
}

export interface EmailLogRepository {
  /** Qué avisos ya salieron para este pedido. Base de la idempotencia. */
  sentKinds(orderCode: string): Promise<EmailKind[]>;
  record(entry: EmailLogEntry): Promise<void>;
}

export const emailLogRepository: EmailLogRepository = {
  async sentKinds(orderCode) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('kind')
      .eq('order_code', orderCode)
      .eq('status', 'sent');

    if (error) throw toHttpError(error, 'emailLog.sentKinds');
    return (data ?? []).map((row) => row.kind as EmailKind);
  },

  async record(entry) {
    const { error } = await getSupabase().from(TABLE).insert({
      order_code: entry.orderCode,
      kind: entry.kind,
      recipient: entry.recipient,
      status: entry.status,
      provider_id: entry.providerId ?? null,
      error: entry.error ?? null,
    });

    // El índice único es la última línea de defensa contra un doble envío por
    // dos clicks simultáneos. Que salte no es un error: es el guardarraíl.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error('[email] no se pudo registrar el envío:', error.message);
    }
  }
};
