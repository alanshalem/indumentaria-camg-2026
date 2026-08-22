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
          <strong className={styles.code}>{lastOrder.code}</strong>
          {lastOrder.date && <span className={styles.date}>· {formatDateTime(lastOrder.date)}</span>}
        </div>
        <button type="button" className={styles.dismiss} onClick={handleDismiss} aria-label="Cerrar aviso">
          ×
        </button>
      </div>
    </div>
  );
}
