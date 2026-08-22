import { create } from 'zustand';
import type { Product } from '@shared/domain/product';
import type { PromotionDefinition } from '@shared/domain/promotions';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { promotionService } from '@/services/promotionService';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  products: Product[];
  promotions: PromotionDefinition[];
  status: Status;
  error: string | null;
  load: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * Catálogo público y promociones activas, cargados una sola vez y compartidos.
 *
 * La grilla y el carrito viven en ramas distintas del árbol —el drawer está en
 * el layout raíz— así que sin un store compartido cada uno pediría los mismos
 * datos por su cuenta y podrían mostrar precios distintos.
 */
export const useCatalogStore = create<CatalogState>()((set, get) => ({
  products: [],
  promotions: [],
  status: 'idle',
  error: null,

  async load({ force = false } = {}) {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) return;

    set({ status: 'loading', error: null });
    try {
      const [products, promotions] = await Promise.all([
        catalogService.list(),
        promotionService.list(),
      ]);
      set({ products, promotions, status: 'ready', error: null });
    } catch (caught) {
      set({ status: 'error', error: errorMessage(caught) });
    }
  },
}));
