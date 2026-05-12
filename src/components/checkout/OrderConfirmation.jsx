import { useState } from 'react';
import { formatPrice, formatDate } from '../../utils/formatters.js';
import styles from './OrderConfirmation.module.css';

export default function OrderConfirmation({ order, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(order.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>✓</div>
      <h3 className={styles.title}>¡Pedido generado!</h3>
      <p className={styles.sub}>Guardá este código. Te lo van a pedir al retirar.</p>

      <div className={styles.codeBox}>
        <span className={styles.codeLabel}>Código de pedido</span>
        <code className={styles.code}>{order.code}</code>
        <button type="button" className="btn btn-ghost" onClick={copyCode}>
          {copied ? '✓ Copiado' : 'Copiar código'}
        </button>
      </div>

      <ul className={styles.details}>
        <li><span>Socio</span><strong>{order.customerName} {order.customerLastName}</strong></li>
        <li><span>Fecha</span><strong>{formatDate(order.timestamp)}</strong></li>
        <li><span>Items</span><strong>{order.items.reduce((a, b) => a + b.quantity, 0)}</strong></li>
        <li><span>Total</span><strong>{formatPrice(order.total)}</strong></li>
      </ul>

      <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
