import { clearLastOrderRef } from '../../utils/storage.js';
import { formatDate } from '../../utils/formatters.js';
import styles from './LastOrderBanner.module.css';

export default function LastOrderBanner({ lastRef, onDismiss }) {
  function handleDismiss() {
    clearLastOrderRef();
    onDismiss();
  }

  return (
    <div className={styles.banner}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.text}>
          <span className={styles.label}>Tu último pedido</span>
          <strong className={styles.code}>{lastRef.code}</strong>
          {lastRef.date && <span className={styles.date}>· {formatDate(lastRef.date)}</span>}
        </div>
        <button type="button" className={styles.dismiss} onClick={handleDismiss} aria-label="Cerrar aviso">
          ×
        </button>
      </div>
    </div>
  );
}
