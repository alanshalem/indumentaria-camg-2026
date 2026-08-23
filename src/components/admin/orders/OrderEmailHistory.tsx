import { useCallback } from 'react';
import {
  EMAIL_KINDS,
  EMAIL_KIND_LABELS,
  type EmailKind,
  type EmailLogRecord,
} from '@shared/domain/orderEmails';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { orderService } from '@/services/orderService';
import { formatDateTime } from '@/utils/formatDate';
import styles from './OrderEmailHistory.module.css';

const NO_RECORDS: EmailLogRecord[] = [];

/** El último intento de cada aviso: es lo que importa, no los reintentos. */
const latestByKind = (records: readonly EmailLogRecord[]): Map<EmailKind, EmailLogRecord> => {
  const latest = new Map<EmailKind, EmailLogRecord>();
  for (const record of records) {
    const previous = latest.get(record.kind);
    // Un envío exitoso siempre gana: un fallo posterior no lo borra.
    if (!previous || (record.status === 'sent' && previous.status !== 'sent')) {
      latest.set(record.kind, record);
    }
  }
  return latest;
};

/**
 * Qué avisos recibió el socio.
 *
 * El `email_log` guardaba todo el historial y no se veía en ningún lado: si el
 * admin entraba al día siguiente, no tenía forma de saber si el mail salió.
 */
export function OrderEmailHistory({ code }: { code: string }) {
  const load = useCallback(() => orderService.emailHistory(code), [code]);
  const { data: records, error, isLoading } = useAsyncResource(load, NO_RECORDS, [load]);

  const latest = latestByKind(records);

  return (
    <div className={styles.wrap}>
      <span className={styles.title}>Avisos al socio</span>

      {isLoading && records.length === 0 ? (
        <span className={styles.loading}>Buscando…</span>
      ) : error ? (
        <span className={styles.error}>{error}</span>
      ) : (
        <ul className={styles.list}>
          {EMAIL_KINDS.map((kind) => {
            const record = latest.get(kind);
            const state = record?.status ?? 'none';

            return (
              <li key={kind} className={`${styles.item} ${styles[state]}`}>
                <span className={styles.mark} aria-hidden="true">
                  {state === 'sent' ? '✓' : state === 'none' ? '·' : '!'}
                </span>
                <span className={styles.label}>{EMAIL_KIND_LABELS[kind]}</span>
                <span className={styles.detail}>
                  {state === 'sent'
                    ? formatDateTime(record!.at)
                    : state === 'none'
                      ? 'sin mandar'
                      : (record!.error ?? 'no salió')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
