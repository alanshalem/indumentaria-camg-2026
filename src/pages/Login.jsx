import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import LoginForm from '../components/admin/LoginForm.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthed } = useAuth();

  useEffect(() => {
    if (isAuthed) navigate('/admin', { replace: true });
  }, [isAuthed, navigate]);

  return <LoginForm />;
}
