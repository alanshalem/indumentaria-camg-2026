import { Outlet, useLocation } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import CartDrawer from './components/cart/CartDrawer.jsx';

export default function App() {
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/login') || location.pathname.startsWith('/admin');

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
