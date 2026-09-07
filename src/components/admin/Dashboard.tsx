import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/ui';
import { Picture } from '@/ui/Picture';
import { OrdersPanel } from './orders/OrdersPanel';
import { ProductsPanel } from './products/ProductsPanel';
import { PromotionsPanel } from './promotions/PromotionsPanel';
import { EmailsPanel } from './emails/EmailsPanel';
import styles from './Dashboard.module.css';

const TABS = [
  { id: 'orders', label: 'Pedidos' },
  { id: 'products', label: 'Productos' },
  { id: 'promotions', label: 'Promos' },
  { id: 'emails', label: 'Mails' },
] as const;

const PANELS: Record<TabId, ComponentType> = {
  orders: OrdersPanel,
  products: ProductsPanel,
  promotions: PromotionsPanel,
  emails: EmailsPanel,
};

type TabId = (typeof TABS)[number]['id'];

/**
 * Shell del panel: sólo navegación y sesión. Cada pestaña es autónoma y se
 * encarga de sus propios datos, así el shell no crece cada vez que se suma una.
 */
export function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState<TabId>('orders');
  const Panel = PANELS[tab];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Picture src="/images/logo-club.png" alt="" sizes="44px" />
          <div>
            <span className={styles.brandSub}>Panel administrativo</span>
            <h1 className={styles.brandTitle}>CAMG 2026</h1>
          </div>
        </div>
        <Button variant="ghost" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Secciones del panel">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <Panel />
    </div>
  );
}
