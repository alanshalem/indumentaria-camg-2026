import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/AppRoutes';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { AuthProvider } from '@/hooks/useAuth';
import '@/styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el nodo #root en index.html.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
