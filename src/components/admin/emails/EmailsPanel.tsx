import { useCallback, useState } from 'react';
import type { EmailPreview } from '@shared/api/contracts';
import { CLUB, missingClubInfo } from '@shared/domain/club';
import { customerFullName, ORDER_STATUS_LABELS, type Order } from '@shared/domain/order';
import {
  EMAIL_KINDS,
  EMAIL_KIND_LABELS,
  statusForEmailKind,
  type EmailKind,
} from '@shared/domain/orderEmails';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { emailService } from '@/services/emailService';
import { orderService } from '@/services/orderService';
import { Alert, SelectField, Spinner } from '@/ui';
import { OrderEmailHistory } from '../orders/OrderEmailHistory';
import styles from './EmailsPanel.module.css';

/** Con qué pedido se renderiza: el de ejemplo o uno real. */
const SAMPLE = '';

const NO_ORDERS: Order[] = [];
const NO_PREVIEW: EmailPreview | null = null;

/**
 * Los cuatro mails que recibe el socio, tal como le llegan.
 *
 * Se renderizan en el servidor porque las plantillas viven ahí: firman el link
 * de seguimiento con un secreto que nunca sale del backend. Acá sólo se muestra
 * el resultado, dentro de un iframe para que el CSS del mail no se mezcle con
 * el del panel.
 */
export function EmailsPanel() {
  const [kind, setKind] = useState<EmailKind>('orderReceived');
  const [code, setCode] = useState<string>(SAMPLE);
  const [view, setView] = useState<'html' | 'text'>('html');

  // Los últimos pedidos, para poder mirar qué le llegó a alguien puntual.
  const loadOrders = useCallback(() => orderService.list({ limit: 25 }), []);
  const { data: page } = useAsyncResource(loadOrders, { orders: NO_ORDERS, total: 0 });

  const loadPreview = useCallback(
    () => emailService.preview(kind, code || undefined),
    [kind, code],
  );
  const { data: preview, error, isLoading } = useAsyncResource(loadPreview, NO_PREVIEW, [
    loadPreview,
  ]);

  const faltantes = missingClubInfo();
  const triggerStatus = statusForEmailKind(kind);

  return (
    <>
      <section className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Mails al socio</h2>
          <p className={styles.sub}>
            Los {EMAIL_KINDS.length} avisos que salen solos al cambiar el estado de un pedido. Acá
            se ven igual que en la casilla del socio.
          </p>
        </div>
      </section>

      {/* Los datos del club salen impresos en los mails: si falta alguno, la
          plantilla omite ese recuadro y conviene saberlo antes de mandar. */}
      {faltantes.length > 0 && (
        <Alert>
          Falta cargar {faltantes.join(', ')} en <code>shared/domain/club.ts</code>. Los mails salen
          igual, pero sin esos datos.
        </Alert>
      )}

      <div className={styles.layout}>
        <aside className={styles.list} aria-label="Mails disponibles">
          {EMAIL_KINDS.map((option) => {
            const status = statusForEmailKind(option);
            return (
              <button
                key={option}
                type="button"
                className={`${styles.item} ${option === kind ? styles.itemOn : ''}`}
                onClick={() => setKind(option)}
                aria-pressed={option === kind}
              >
                <span className={styles.itemName}>{EMAIL_KIND_LABELS[option]}</span>
                <span className={styles.itemWhen}>
                  {status ? `al pasar a "${ORDER_STATUS_LABELS[status]}"` : 'sin disparador'}
                </span>
              </button>
            );
          })}

          <div className={styles.picker}>
            <SelectField
              label="Ver con"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              hint={
                code
                  ? 'Se muestra con los datos reales de ese pedido.'
                  : 'Pedido inventado, con dos talles, un color y una promo aplicada.'
              }
            >
              <option value={SAMPLE}>Pedido de ejemplo</option>
              {page.orders.map((order) => (
                <option key={order.code} value={order.code}>
                  {order.code} · {customerFullName(order)}
                </option>
              ))}
            </SelectField>
          </div>

          {/* Qué recibió de verdad ese socio, con fecha. */}
          {code && <OrderEmailHistory code={code} />}
        </aside>

        <section className={styles.preview} aria-label="Vista previa del mail">
          {error && <Alert>{error}</Alert>}

          {isLoading && !preview ? (
            <div className={styles.loading}>
              <Spinner size={26} label="Armando la vista previa…" />
            </div>
          ) : (
            preview && (
              <>
                <header className={styles.head}>
                  <dl className={styles.meta}>
                    <div>
                      <dt>De</dt>
                      <dd>{CLUB.name}</dd>
                    </div>
                    <div>
                      <dt>Para</dt>
                      <dd>{preview.recipient || <em className={styles.warn}>sin mail</em>}</dd>
                    </div>
                    <div>
                      <dt>Asunto</dt>
                      <dd className={styles.subject}>{preview.subject}</dd>
                    </div>
                  </dl>

                  <div className={styles.viewToggle} role="group" aria-label="Formato">
                    <button
                      type="button"
                      className={view === 'html' ? styles.viewOn : styles.viewOff}
                      onClick={() => setView('html')}
                      aria-pressed={view === 'html'}
                    >
                      Como se ve
                    </button>
                    <button
                      type="button"
                      className={view === 'text' ? styles.viewOn : styles.viewOff}
                      onClick={() => setView('text')}
                      aria-pressed={view === 'text'}
                      title="Lo que ven los clientes de correo que no muestran HTML"
                    >
                      Texto plano
                    </button>
                  </div>
                </header>

                {view === 'html' ? (
                  // `sandbox` vacío: la plantilla es HTML de tabla sin scripts y
                  // así se queda sin permisos para ejecutar nada ni navegar.
                  <iframe
                    key={`${preview.kind}-${code}`}
                    className={styles.frame}
                    title={`Vista previa de "${EMAIL_KIND_LABELS[preview.kind]}"`}
                    srcDoc={preview.html}
                    sandbox=""
                  />
                ) : (
                  <pre className={styles.text}>{preview.text}</pre>
                )}

                <footer className={styles.foot}>
                  {preview.isSample ? (
                    <span>
                      Pedido de ejemplo. Elegí uno real arriba para ver el mail con esos datos.
                    </span>
                  ) : (
                    <span>Renderizado con los datos reales de {code}.</span>
                  )}
                  {triggerStatus && (
                    <span>
                      Sale solo cuando el pedido pasa a «{ORDER_STATUS_LABELS[triggerStatus]}».
                    </span>
                  )}
                </footer>
              </>
            )
          )}
        </section>
      </div>
    </>
  );
}
