import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Dashboard from '../components/admin/Dashboard.jsx';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthed } = useAuth();

  useEffect(() => {
    if (!isAuthed) {
      const ok = sessionStorage.getItem('camg_admin') === 'true';
      if (!ok) navigate('/login', { replace: true });
    }
  }, [isAuthed, navigate]);

  return <Dashboard />;
}
