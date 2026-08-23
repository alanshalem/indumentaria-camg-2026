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
  wasSent(orderCode: string, kind: EmailKind): Promise<boolean>;
  record(entry: EmailLogEntry): Promise<void>;
}

export const emailLogRepository: EmailLogRepository = {
  async wasSent(orderCode, kind) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('id')
      .eq('order_code', orderCode)
      .eq('kind', kind)
      .eq('status', 'sent')
      .maybeSingle();

    if (error) throw toHttpError(error, 'emailLog.wasSent');
    return data !== null;
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
