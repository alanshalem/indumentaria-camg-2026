import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderItemInput } from '@shared/domain/order';
import type { SizeTier } from '@shared/domain/product';
import { expandUnits, type PricedUnit } from '@shared/domain/promotions';
import { MAX_UNITS_PER_LINE } from '@shared/schemas/order.schema';

/**
 * Línea del carrito. `productName`, `unitPrice` e `image` son una copia local
 * para poder dibujar el carrito sin ir al servidor: NO son la fuente de verdad.
 * El precio final lo recalcula la API con los datos de la base.
 */
export interface CartLine {
  productId: string;
  productName: string;
  size: string;
  sizeTier: SizeTier;
  color: string | null;
  quantity: number;
  unitPrice: number;
  image: string;
}

export type CartLineDraft = Omit<CartLine, 'quantity'> & { quantity?: number };

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (draft: CartLineDraft) => void;
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

/** Identidad de una línea: el mismo producto en otro talle o color es otra línea. */
export const lineKey = (line: Pick<CartLine, 'productId' | 'size' | 'color'>): string =>
  `${line.productId}__${line.size}__${line.color ?? ''}`;

const clampQuantity = (value: number): number =>
  Math.min(MAX_UNITS_PER_LINE, Math.max(1, Math.trunc(value)));

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addLine: (draft) =>
        set((state) => {
          const key = lineKey(draft);
          const existing = state.lines.find((line) => lineKey(line) === key);
          const added = clampQuantity(draft.quantity ?? 1);

          return {
            lines: existing
              ? state.lines.map((line) =>
                  lineKey(line) === key
                    ? { ...line, quantity: clampQuantity(line.quantity + added) }
                    : line,
                )
              : [...state.lines, { ...draft, quantity: added }],
          };
        }),

      removeLine: (key) =>
        set((state) => ({ lines: state.lines.filter((line) => lineKey(line) !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            lineKey(line) === key ? { ...line, quantity: clampQuantity(quantity) } : line,
          ),
        })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'camg_cart',
      // v3: los precios pasaron a depender del talle y las líneas guardan color.
      version: 3,
      partialize: (state) => ({ lines: state.lines }),
      // Un carrito viejo tiene precios de otra lista: se descarta en vez de
      // arrastrar importes que ya no existen.
      migrate: () => ({ lines: [] }) as never,
    },
  ),
);

/** Lo único que viaja al servidor: qué, en qué talle y color, y cuánto. Sin precios. */
export const toOrderItems = (lines: readonly CartLine[]): OrderItemInput[] =>
  lines.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity }));

export const cartUnitCount = (lines: readonly CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/** Unidades sueltas para alimentar el motor de promociones. */
export const cartUnits = (lines: readonly CartLine[]): PricedUnit[] =>
  expandUnits(lines, (line) => ({
    lineKey: lineKey(line),
    productId: line.productId,
    productName: line.productName,
    size: line.size,
    tier: line.sizeTier,
    unitPrice: line.unitPrice,
  }));
