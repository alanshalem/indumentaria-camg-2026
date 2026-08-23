import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@shared/domain/order';
import styles from './OrderTimeline.module.css';

/** Qué pasa en cada etapa, contado desde el lado del socio. */
const STEP_DETAIL: Record<OrderStatus, string> = {
  pending: 'Generaste el pedido. Falta que se acredite el pago.',
  paid: 'Recibimos el pago y encargamos tu pedido.',
  ready: 'Tu pedido está en la sede, podés pasar a retirarlo.',
  delivered: 'Retiraste tu pedido. ¡Listo!',
};

/**
 * Línea de tiempo del pedido.
 *
 * Es la razón de ser de la página de seguimiento: de un vistazo se ve en qué
 * etapa está y qué falta, sin tener que interpretar una etiqueta suelta.
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_STATUSES.indexOf(status);

  return (
    <ol className={styles.timeline}>
      {ORDER_STATUSES.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';

        return (
          <li key={step} className={`${styles.step} ${styles[state]}`}>
            <span className={styles.marker} aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <div className={styles.text}>
              <span className={styles.label}>
                {ORDER_STATUS_LABELS[step]}
                {state === 'current' && <em className={styles.badge}>Ahora</em>}
              </span>
              <span className={styles.detail}>{STEP_DETAIL[step]}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
