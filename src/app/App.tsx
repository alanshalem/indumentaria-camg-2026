import { Outlet, useLocation } from 'react-router-dom';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

const ADMIN_PREFIXES = ['/login', '/admin'];

/** Layout raíz. El área admin no muestra header, footer ni carrito. */
export function App() {
  const { pathname } = useLocation();
  const isAdminArea = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="app-shell">
      {!isAdminArea && <Header />}
      <main className="app-main">
        <Outlet />
      </main>
      {!isAdminArea && <Footer />}
      {!isAdminArea && <CartDrawer />}
    </div>
  );
}
