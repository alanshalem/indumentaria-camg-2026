import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { Order } from '@shared/domain/order';
import { evaluatePromotions } from '@shared/domain/promotions';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { cartUnitCount, cartUnits, lineKey, useCartStore } from '@/store/cartStore';
import { useCatalogStore } from '@/store/catalogStore';
import { Button, EmptyState, QuantityStepper } from '@/ui';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { OrderConfirmation } from '@/components/checkout/OrderConfirmation';
import { CartSummary } from './CartSummary';
import styles from './CartDrawer.module.css';

/** Máquina de estados del drawer: carrito → checkout → confirmación. */
type Stage = 'cart' | 'checkout' | 'done';

const TITLE_BY_STAGE: Record<Stage, string> = {
  cart: 'Tu carrito',
  checkout: 'Finalizar pedido',
  done: '¡Pedido generado!',
};

const RESET_DELAY_MS = 300;

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const lines = useCartStore((state) => state.lines);
  const removeLine = useCartStore((state) => state.removeLine);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const promotions = useCatalogStore((state) => state.promotions);

  const [stage, setStage] = useState<Stage>('cart');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, closeCart);

  // Al cerrar se vuelve al paso 1, con delay para no ver el cambio durante la animación.
  useEffect(() => {
    if (isOpen) return;
    const timeout = setTimeout(() => {
      setStage('cart');
      setPlacedOrder(null);
    }, RESET_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  // Misma función que corre el servidor al cerrar el pedido: la previsualización
  // no puede diferir del importe final porque es literalmente el mismo código.
  const outcome = useMemo(
    () => evaluatePromotions(cartUnits(lines), promotions),
    [lines, promotions],
  );

  const unitCount = cartUnitCount(lines);

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={closeCart}
        aria-hidden="true"
      />
      <aside
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label="Carrito"
        aria-hidden={!isOpen}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>
            {TITLE_BY_STAGE[stage]}
            {stage === 'cart' && unitCount > 0 && <span className={styles.count}>({unitCount})</span>}
          </h2>
          <button type="button" onClick={closeCart} className={styles.closeBtn} aria-label="Cerrar carrito">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {stage === 'cart' &&
            (lines.length === 0 ? (
              <EmptyState title="Tu carrito está vacío.">
                <Button variant="ghost" onClick={closeCart}>
                  Seguir comprando
                </Button>
              </EmptyState>
            ) : (
              <ul className={styles.list}>
                {lines.map((line) => {
                  const key = lineKey(line);
                  return (
                    <li key={key} className={styles.item}>
                      <img src={line.image} alt="" className={styles.itemImg} />
                      <div className={styles.itemInfo}>
                        <p className={styles.itemName}>{line.productName}</p>
                        <p className={styles.itemMeta}>
                          Talle {line.size}
                          {line.color && ` · ${line.color}`}
                        </p>
                        <p className={styles.itemPrice}>{formatPrice(line.unitPrice * line.quantity)}</p>
                        <div className={styles.itemActions}>
                          <QuantityStepper
                            value={line.quantity}
                            onChange={(next) => setQuantity(key, next)}
                            label={`Cantidad de ${line.productName}`}
                          />
                          <button type="button" className={styles.remove} onClick={() => removeLine(key)}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}

          {stage === 'checkout' && (
            <CheckoutForm
              outcome={outcome}
              onBack={() => setStage('cart')}
              onComplete={(order) => {
                setPlacedOrder(order);
                setStage('done');
              }}
            />
          )}

          {stage === 'done' && placedOrder && (
            <OrderConfirmation order={placedOrder} onClose={closeCart} />
          )}
        </div>

        {stage === 'cart' && lines.length > 0 && (
          <div className={styles.footer}>
            <CartSummary outcome={outcome} />
            <Button block onClick={() => setStage('checkout')}>
              Generar pedido
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
