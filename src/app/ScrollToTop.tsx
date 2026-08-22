import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Al navegar entre rutas el browser conserva el scroll: entrar a una ficha de
 * producto desde la mitad del catálogo dejaba la página empezada por el medio.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
