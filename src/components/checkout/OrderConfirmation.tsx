import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PAGES, type OrderCreated } from '@shared/api/contracts';
import { CLUB } from '@shared/domain/club';
import { countOrderUnits, customerFullName } from '@shared/domain/order';
import { formatDateTime } from '@/utils/formatDate';
import { Button } from '@/ui';
import { CartSummary } from '@/components/cart/CartSummary';
import styles from './OrderConfirmation.module.css';

const COPIED_FEEDBACK_MS = 1800;

export function OrderConfirmation({
  created,
  onClose,
}: {
  created: OrderCreated;
  onClose: () => void;
}) {
  const { order, statusToken } = created;
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Sin permiso de portapapeles el código igual está visible en pantalla.
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>✓</div>
      <h3 className={styles.title}>¡Pedido generado!</h3>
      <p className={styles.sub}>
        Te mandamos el detalle por mail. Guardá el código: te lo van a pedir al retirar.
      </p>

      <div className={styles.codeBox}>
        <span className={styles.codeLabel}>Código de pedido</span>
        <code className={styles.code}>{order.code}</code>
        <Button variant="ghost" onClick={() => void copyCode()}>
          {copied ? '✓ Copiado' : 'Copiar código'}
        </Button>
      </div>

      <ul className={styles.details}>
        <li>
          <span>Socio</span>
          <strong>{customerFullName(order)}</strong>
        </li>
        <li>
          <span>Fecha</span>
          <strong>{formatDateTime(order.timestamp)}</strong>
        </li>
        {/* Ultima chance de que el socio note un mail mal escrito: si no le
            llega nada, no tiene cuenta ni forma de recuperar el pedido. */}
        {order.email && (
          <li>
            <span>Te escribimos a</span>
            <strong>{order.email}</strong>
          </li>
        )}
        <li>
          <span>Items</span>
          <strong>{countOrderUnits(order.items)}</strong>
        </li>
      </ul>

      <div className={styles.summaryBox}>
        <CartSummary
          outcome={{
            subtotal: order.subtotal,
            discounts: order.promotions,
            discountTotal: order.subtotal - order.total,
            total: order.total,
          }}
          compact
        />
      </div>

      {CLUB.pickupAddress && (
        <p className={styles.pickup}>
          Se retira en <strong>{CLUB.pickupAddress}</strong>
          {CLUB.pickupHours.length > 0 && ` · ${CLUB.pickupHours.join(' · ')}`}
        </p>
      )}

      {/* El link firmado, en pantalla y no sólo en el mail. */}
      <Link to={PAGES.orderStatus(order.code, statusToken)} className={styles.track} onClick={onClose}>
        Seguir mi pedido →
      </Link>

      <Button block variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}
