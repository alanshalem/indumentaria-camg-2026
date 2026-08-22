import { useEffect } from 'react';
import type { Product } from '@shared/domain/product';
import { useCatalogStore } from '@/store/catalogStore';

type Status = 'loading' | 'found' | 'missing' | 'error';

interface Result {
  product: Product | null;
  status: Status;
  error: string | null;
}

/**
 * Un producto del catálogo ya cargado en memoria.
 *
 * Reusa el store en vez de pedir el producto suelto: si el socio llega desde la
 * grilla no hay request nuevo, y si entra directo por la URL se carga el
 * catálogo completo una sola vez (son ocho productos, no un marketplace).
 */
export function useCatalogProduct(id: string | undefined): Result {
  const products = useCatalogStore((state) => state.products);
  const storeStatus = useCatalogStore((state) => state.status);
  const error = useCatalogStore((state) => state.error);
  const load = useCatalogStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const product = id ? (products.find((item) => item.id === id) ?? null) : null;

  if (product) return { product, status: 'found', error: null };
  if (storeStatus === 'error') return { product: null, status: 'error', error };
  if (storeStatus === 'ready') return { product: null, status: 'missing', error: null };
  return { product: null, status: 'loading', error: null };
}
