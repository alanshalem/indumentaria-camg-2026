import { useCallback, useState } from 'react';
import { errorMessage } from '@/services/apiError';

interface AdminAction {
  /** Id de la fila en curso: sirve para deshabilitar sólo esa. */
  busyId: string | null;
  notice: string;
  error: string;
  run: (id: string, action: () => Promise<void>, successMessage: string) => Promise<void>;
  /** Avisa sin ejecutar nada: para acciones que ya resolvió otro componente. */
  notify: (message: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

/**
 * El trío "fila ocupada / aviso de éxito / error" de los paneles de admin.
 *
 * Estaba escrito dos veces, una en el panel de productos y otra en el de
 * promociones, con la misma secuencia de seis `useState` y el mismo try/finally.
 */
export function useAdminAction(): AdminAction {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const run = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string) => {
      setError('');
      setNotice('');
      setBusyId(id);
      try {
        await action();
        setNotice(successMessage);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const notify = useCallback((message: string) => {
    setError('');
    setNotice(message);
  }, []);

  const reset = useCallback(() => {
    setError('');
    setNotice('');
  }, []);

  return { busyId, notice, error, run, notify, setError, reset };
}
