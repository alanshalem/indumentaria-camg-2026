import { useEffect, useState } from 'react';
import { useCartStore, lineKey } from '../../store/cartStore.js';
import { formatPrice } from '../../utils/formatters.js';
import CheckoutForm from '../checkout/CheckoutForm.jsx';
import OrderConfirmation from '../checkout/OrderConfirmation.jsx';
import styles from './CartDrawer.module.css';

export default function CartDrawer() {
  const isOpen = useCartStore(s => s.isOpen);
  const closeCart = useCartStore(s => s.closeCart);
  const items = useCartStore(s => s.items);
  const removeItem = useCartStore(s => s.removeItem);
  const setQuantity = useCartStore(s => s.setQuantity);
  const totalPrice = useCartStore(s => s.items.reduce((a, b) => a + (b.unitPrice || 0) * b.quantity, 0));
  const totalCount = useCartStore(s => s.items.reduce((a, b) => a + b.quantity, 0));

  const [stage, setStage] = useState('cart'); // 'cart' | 'checkout' | 'done'
  const [doneOrder, setDoneOrder] = useState(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // Reset stage cuando se cierra (con un pequeño delay para no parpadear)
      const t = setTimeout(() => {
        setStage('cart');
        setDoneOrder(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={closeCart}
        aria-hidden={!isOpen}
      />
      <aside
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label="Carrito"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>
            {stage === 'done' ? '¡Pedido generado!' : stage === 'checkout' ? 'Finalizar pedido' : 'Tu carrito'}
            {stage === 'cart' && totalCount > 0 && <span className={styles.count}>({totalCount})</span>}
          </h2>
          <button type="button" onClick={closeCart} className={styles.closeBtn} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {stage === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <p>Tu carrito está vacío.</p>
                  <button type="button" className="btn btn-ghost" onClick={closeCart}>Seguir comprando</button>
                </div>
              ) : (
                <ul className={styles.list}>
                  {items.map(item => {
                    const key = lineKey(item);
                    return (
                      <li key={key} className={styles.item}>
                        <img src={item.image} alt="" className={styles.itemImg} />
                        <div className={styles.itemInfo}>
                          <p className={styles.itemName}>{item.productName}</p>
                          <p className={styles.itemMeta}>Talle {item.size}</p>
                          <p className={styles.itemPrice}>{formatPrice((item.unitPrice || 0) * item.quantity)}</p>
                          <div className={styles.itemActions}>
                            <div className={styles.qty}>
                              <button type="button" onClick={() => setQuantity(key, item.quantity - 1)} aria-label="Restar">−</button>
                              <span>{item.quantity}</span>
                              <button type="button" onClick={() => setQuantity(key, item.quantity + 1)} aria-label="Sumar">+</button>
                            </div>
                            <button type="button" className={styles.remove} onClick={() => removeItem(key)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {stage === 'checkout' && (
            <CheckoutForm
              onBack={() => setStage('cart')}
              onComplete={(order) => { setDoneOrder(order); setStage('done'); }}
            />
          )}

          {stage === 'done' && doneOrder && (
            <OrderConfirmation order={doneOrder} onClose={closeCart} />
          )}
        </div>

        {stage === 'cart' && items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.totalVal}>{formatPrice(totalPrice)}</span>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStage('checkout')}>
              Generar pedido
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
