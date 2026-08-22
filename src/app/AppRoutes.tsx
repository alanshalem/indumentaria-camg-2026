import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { RequireAdmin } from './RequireAdmin';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';

/** Mapa de rutas de la app. Un solo archivo para saber qué existe y qué protege qué. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
