import { Link } from 'react-router-dom';
import { PAGES } from '@shared/api/contracts';
import { lastOrderStorage, type LastOrderRef } from '@/services/lastOrderStorage';
import { formatDateTime } from '@/utils/formatDate';
import styles from './LastOrderBanner.module.css';

interface Props {
  lastOrder: LastOrderRef;
  onDismiss: () => void;
}

export function LastOrderBanner({ lastOrder, onDismiss }: Props) {
  function handleDismiss() {
    lastOrderStorage.clear();
    onDismiss();
  }

  return (
    <div className={styles.banner}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.text}>
          <span className={styles.label}>Tu último pedido</span>
          {/* Con token es un link al seguimiento; sin él (pedidos viejos, de
              antes de que el link existiera) queda como texto. */}
          {lastOrder.token ? (
            <Link
              to={PAGES.orderStatus(lastOrder.code, lastOrder.token)}
              className={`${styles.code} ${styles.codeLink}`}
            >
              {lastOrder.code}
            </Link>
          ) : (
            <strong className={styles.code}>{lastOrder.code}</strong>
          )}
          {lastOrder.date && <span className={styles.date}>· {formatDateTime(lastOrder.date)}</span>}
          {lastOrder.token && (
            <Link to={PAGES.orderStatus(lastOrder.code, lastOrder.token)} className={styles.cta}>
              Ver estado →
            </Link>
          )}
        </div>
        <button type="button" className={styles.dismiss} onClick={handleDismiss} aria-label="Cerrar aviso">
          ×
        </button>
      </div>
    </div>
  );
}
