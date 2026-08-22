import { Dashboard } from '@/components/admin/Dashboard';

/**
 * La protección de esta ruta vive en <RequireAdmin> (cosmética) y, sobre todo,
 * en el guard `adminOnly` de cada endpoint de la API (efectiva).
 */
export function AdminDashboardPage() {
  return <Dashboard />;
}
