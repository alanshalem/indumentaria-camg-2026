import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function lineKey(item) {
  return `${item.productId}__${item.size}__${item.color}`;
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set(s => ({ isOpen: !s.isOpen })),

      addItem: (item) => {
        const key = lineKey(item);
        const items = get().items.slice();
        const idx = items.findIndex(i => lineKey(i) === key);
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + (item.quantity || 1) };
        } else {
          items.push({ ...item, quantity: item.quantity || 1 });
        }
        set({ items });
      },

      removeItem: (key) => {
        set({ items: get().items.filter(i => lineKey(i) !== key) });
      },

      setQuantity: (key, quantity) => {
        if (quantity < 1) return;
        set({
          items: get().items.map(i =>
            lineKey(i) === key ? { ...i, quantity } : i
          ),
        });
      },

      clear: () => set({ items: [] }),

      totalCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0),
    }),
    {
      name: 'camg_cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export { lineKey };
