import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/services/apiError';

export interface AsyncResource<T> {
  data: T;
  error: string | null;
  isLoading: boolean;
  /** Vuelve a pedir los datos manteniendo lo que ya se está mostrando. */
  reload: () => Promise<void>;
  /** Actualización optimista: reemplaza el estado sin ir al servidor. */
  set: (updater: (current: T) => T) => void;
}

/**
 * Un solo lugar para el trío loading/error/data. Antes cada pantalla lo
 * reimplementaba con tres `useState` y sin cancelación, así que una respuesta
 * lenta podía pisar a una más nueva (race condition) o setear estado sobre un
 * componente ya desmontado.
 */
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  initialData: T,
  deps: readonly unknown[] = [],
): AsyncResource<T> {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const result = await loaderRef.current();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(errorMessage(caught));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const set = useCallback((updater: (current: T) => T) => setData(updater), []);

  return { data, error, isLoading, reload, set };
}
