import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { PATHS } from './paths';
import { RequireAdmin } from './RequireAdmin';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { OrderStatusPage } from '@/pages/OrderStatusPage';
import { ProductPage } from '@/pages/ProductPage';
import { Spinner } from '@/ui';

/**
 * El panel viaja en su propio chunk.
 *
 * Lo usan una o dos personas del club; el resto del mundo entra al catálogo y
 * no tiene por qué descargarse el formulario de productos, el editor de promos
 * ni el armador de planillas de Excel.
 */
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);

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
              <Suspense
                fallback={
                  <div className="centered-viewport">
                    <Spinner size={28} label="Cargando el panel…" />
                  </div>
                }
              >
                <AdminDashboardPage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to={PATHS.home} replace />} />
      </Route>
    </Routes>
  );
}
