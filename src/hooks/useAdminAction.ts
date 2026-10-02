import { useCallback, useState } from 'react';
import { errorMessage } from '@/services/apiError';

/** Qué mostrarle al admin cuando la acción terminó, y con qué tono. */
export interface ActionOutcome {
  tone: 'success' | 'error';
  text: string;
}

/**
 * Qué anunciar cuando la acción salió bien.
 *
 * Un string alcanza para la mayoría. Una función permite que el mensaje —y el
 * tono— salgan de lo que devolvió el servidor: cambiar un estado puede terminar
 * con el mail enviado, con el mail ya enviado antes o con el envío fallado, y
 * las tres cosas se cuentan distinto. `null` es para el control interno, que no
 * tiene nada que anunciar.
 */
type Report<T> = string | ((result: T) => ActionOutcome) | null;

interface AdminAction {
  /** Id de la fila en curso: sirve para deshabilitar sólo esa. */
  busyId: string | null;
  notice: string;
  error: string;
  run: <T>(
    id: string,
    action: () => Promise<T>,
    report?: Report<T>,
    whenItFails?: string,
  ) => Promise<void>;
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
 * Los tres componentes de pedidos —lo último que se escribió— lo volvieron a
 * escribir a mano, con seis `try/catch` más: una abstracción que la mitad del
 * código ignora es peor que no tenerla, porque el que llega después tiene que
 * adivinar cuál de los dos patrones imitar.
 */
export function useAdminAction(): AdminAction {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const run = useCallback(
    async <T,>(
      id: string,
      action: () => Promise<T>,
      report: Report<T> = null,
      whenItFails?: string,
    ) => {
      setError('');
      setNotice('');
      setBusyId(id);
      try {
        const outcome = describe(report, await action());
        if (!outcome) return;
        if (outcome.tone === 'error') setError(outcome.text);
        else setNotice(outcome.text);
      } catch (caught) {
        setError(errorMessage(caught, whenItFails));
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

function describe<T>(report: Report<T>, result: T): ActionOutcome | null {
  if (report === null) return null;
  if (typeof report === 'function') return report(result);
  return { tone: 'success', text: report };
}
