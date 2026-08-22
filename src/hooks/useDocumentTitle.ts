import { useEffect } from 'react';

const BASE_TITLE = 'CAMG - Indumentaria Oficial';

/** Título de la pestaña por pantalla. Al desmontar vuelve al título base. */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
