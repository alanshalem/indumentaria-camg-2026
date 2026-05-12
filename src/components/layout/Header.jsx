import { Link } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore.js';
import styles from './Header.module.css';

export default function Header() {
  const totalCount = useCartStore(s => s.items.reduce((a, b) => a + b.quantity, 0));
  const openCart = useCartStore(s => s.openCart);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand}>
          <img src="/images/logo-club.png" alt="Club Atlético Monte Grande" className={styles.logo} />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Club Atlético</span>
            <span className={styles.brandSub}>Monte Grande</span>
          </div>
        </Link>

        <button
          type="button"
          className={styles.cartBtn}
          onClick={openCart}
          aria-label={`Abrir carrito (${totalCount} items)`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13l-1.5 6h12M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          {totalCount > 0 && <span className={styles.badge}>{totalCount}</span>}
        </button>
      </div>
    </header>
  );
}
