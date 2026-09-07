import {
  isStage,
  ORDER_STAGES,
  ORDER_STATUS_LABELS,
  type OrderStage,
  type OrderStatus,
} from '@shared/domain/order';
import styles from './OrderTimeline.module.css';

/** Qué pasa en cada etapa, contado desde el lado del socio. */
const STEP_DETAIL: Record<OrderStage, string> = {
  pending: 'Generaste el pedido. Falta que se acredite el pago.',
  deposit: 'Recibimos tu seña. Falta completar el resto del pago.',
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
  // Un pedido eliminado no está en ninguna etapa: mostrar la línea de tiempo
  // con cuatro pasos apagados diría que "está por empezar", que es mentira.
  if (!isStage(status)) {
    return (
      <div className={styles.cancelled} role="status">
        <span className={styles.cancelledMark} aria-hidden="true">
          ✕
        </span>
        <div className={styles.text}>
          <span className={styles.cancelledLabel}>{ORDER_STATUS_LABELS.cancelled}</span>
          <span className={styles.detail}>
            El club dio de baja este pedido. Si creés que fue un error, escribiles con el código.
          </span>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STAGES.indexOf(status);

  return (
    <ol className={styles.timeline}>
      {ORDER_STAGES.map((step, index) => {
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
