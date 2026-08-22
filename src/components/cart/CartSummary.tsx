import { formatPrice } from '@shared/domain/money';
import type { PromotionOutcome } from '@shared/domain/promotions';
import styles from './CartSummary.module.css';

/**
 * Desglose de subtotal, promociones y total.
 * Lo usan el carrito (previsualización) y la confirmación del pedido (importes
 * ya cerrados por el servidor), así que el socio ve exactamente el mismo
 * desglose antes y después de comprar.
 */
export function CartSummary({
  outcome,
  compact = false,
}: {
  outcome: PromotionOutcome;
  compact?: boolean;
}) {
  const hasDiscounts = outcome.discounts.length > 0;

  return (
    <div className={`${styles.summary} ${compact ? styles.compact : ''}`}>
      {hasDiscounts && (
        <>
          <div className={styles.row}>
            <span>Subtotal</span>
            <span>{formatPrice(outcome.subtotal)}</span>
          </div>

          <ul className={styles.promoList}>
            {outcome.discounts.map((discount, index) => (
              <li key={`${discount.id}-${index}`} className={styles.promoRow}>
                <span className={styles.promoText}>
                  <strong>{discount.label}</strong>
                  <em>{discount.detail}</em>
                </span>
                <span className={styles.promoAmount}>−{formatPrice(discount.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.totalRow}>
        <span>Total</span>
        <span className={styles.totalValue}>{formatPrice(outcome.total)}</span>
      </div>

      {hasDiscounts && (
        <p className={styles.saved}>Ahorrás {formatPrice(outcome.discountTotal)} con las promos.</p>
      )}
    </div>
  );
}
