import { Outlet, useLocation } from 'react-router-dom';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SizeChartViewer } from '@/components/products/SizeGuide';
import { ScrollToTop } from './ScrollToTop';

const ADMIN_PREFIXES = ['/login', '/admin'];

/**
 * Layout raíz. El área admin no muestra header, footer ni carrito.
 * El carrito y el visor de talles se montan una sola vez acá: son capas
 * globales que abren tanto la home como la ficha de producto.
 */
export function App() {
  const { pathname } = useLocation();
  const isAdminArea = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="app-shell">
      <ScrollToTop />
      {!isAdminArea && <Header />}
      <main className="app-main">
        <Outlet />
      </main>
      {!isAdminArea && <Footer />}
      {!isAdminArea && <CartDrawer />}
      {!isAdminArea && <SizeChartViewer />}
    </div>
  );
}
