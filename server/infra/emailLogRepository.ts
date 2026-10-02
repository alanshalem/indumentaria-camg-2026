import type { EmailKind, EmailLogRecord } from '../../shared/domain/orderEmails.js';

export type { EmailLogRecord };
import { rowsOf } from './postgrestResult.js';
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

/** Las columnas tal como las devuelve `email_log`. */
interface SentKindRow {
  kind: EmailKind;
}

interface HistoryRow {
  kind: EmailKind;
  status: EmailLogStatus;
  recipient: string;
  error: string | null;
  created_at: string;
}

export interface EmailLogRepository {
  /** Qué avisos ya salieron para este pedido. Base de la idempotencia. */
  sentKinds(orderCode: string): Promise<EmailKind[]>;
  /** Todo el historial del pedido, del más nuevo al más viejo. */
  history(orderCode: string): Promise<EmailLogRecord[]>;
  record(entry: EmailLogEntry): Promise<void>;
}

export const emailLogRepository: EmailLogRepository = {
  async sentKinds(orderCode) {
    const result = await getSupabase()
      .from(TABLE)
      .select('kind')
      .eq('order_code', orderCode)
      .eq('status', 'sent');

    return rowsOf<SentKindRow>(result, 'emailLog.sentKinds').map((row) => row.kind);
  },

  async history(orderCode) {
    const result = await getSupabase()
      .from(TABLE)
      .select('kind, status, recipient, error, created_at')
      .eq('order_code', orderCode)
      .order('created_at', { ascending: false });

    return rowsOf<HistoryRow>(result, 'emailLog.history').map((row) => ({
      kind: row.kind,
      status: row.status,
      recipient: row.recipient,
      error: row.error ?? null,
      at: new Date(row.created_at).getTime(),
    }));
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
