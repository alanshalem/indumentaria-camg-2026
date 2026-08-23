import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { PATHS } from './paths';
import { RequireAdmin } from './RequireAdmin';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { OrderStatusPage } from '@/pages/OrderStatusPage';
import { ProductPage } from '@/pages/ProductPage';

/** Mapa de rutas de la app. Un solo archivo para saber qué existe y qué protege qué. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.home} element={<App />}>
        <Route index element={<HomePage />} />
        <Route path={PATHS.product} element={<ProductPage />} />
        <Route path={PATHS.orderStatus} element={<OrderStatusPage />} />
        <Route path={PATHS.login} element={<LoginPage />} />
        <Route
          path={PATHS.admin}
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to={PATHS.home} replace />} />
      </Route>
    </Routes>
  );
}
