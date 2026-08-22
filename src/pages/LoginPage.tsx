import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/components/admin/LoginForm';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  return <LoginForm />;
}
