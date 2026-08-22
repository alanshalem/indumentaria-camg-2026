import { useEffect } from 'react';

/**
 * Congela el scroll del documento mientras hay una capa modal abierta.
 * Lo usaban por separado el carrito y la guía de talles, cada uno con su propia
 * versión y su propio bug al restaurar el valor previo.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
