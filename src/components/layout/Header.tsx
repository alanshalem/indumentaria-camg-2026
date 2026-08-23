import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PAGES } from '@shared/api/contracts';
import { cartUnitCount, useCartStore } from '@/store/cartStore';
import { useSizeChartStore } from '@/store/sizeChartStore';
import { lastOrderStorage, type LastOrderRef } from '@/services/lastOrderStorage';
import styles from './Header.module.css';
import { Picture } from '@/ui/Picture';

export function Header() {
  const unitCount = useCartStore((state) => cartUnitCount(state.lines));
  const openCart = useCartStore((state) => state.openCart);
  const openSizeChart = useSizeChartStore((state) => state.open);

  // El seguimiento sólo aparece si este navegador tiene un pedido guardado:
  // un link a "mi pedido" que no lleva a ninguno es peor que no tenerlo.
  const [lastOrder, setLastOrder] = useState<LastOrderRef | null>(null);
  useEffect(() => setLastOrder(lastOrderStorage.read()), []);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand}>
          <Picture
            src="/images/logo-club.png"
            alt="Club Atlético Monte Grande"
            sizes="44px"
            className={styles.logo}
            eager
          />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Club Atlético</span>
            <span className={styles.brandSub}>Monte Grande</span>
          </div>
        </Link>

        <nav className={styles.nav} aria-label="Accesos">
          {/* Las dos cosas que un socio busca y que antes sólo se encontraban
              scrolleando hasta el fondo o volviendo al mail. */}
          <button type="button" className={styles.navLink} onClick={() => openSizeChart('buzos')}>
            Guía de talles
          </button>
          {lastOrder?.token && (
            <Link
              to={PAGES.orderStatus(lastOrder.code, lastOrder.token)}
              className={styles.navLink}
            >
              Mi pedido
            </Link>
          )}
        </nav>

        <button
          type="button"
          className={styles.cartBtn}
          onClick={openCart}
          aria-label={`Abrir carrito (${unitCount} ${unitCount === 1 ? 'item' : 'items'})`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13l-1.5 6h12M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          {unitCount > 0 && <span className={styles.badge}>{unitCount}</span>}
        </button>
      </div>
    </header>
  );
}
