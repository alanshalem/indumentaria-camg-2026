import { create } from 'zustand';
import type { SizeChartId } from '@shared/domain/sizeCharts';

interface SizeChartState {
  activeId: SizeChartId | null;
  open: (id: SizeChartId) => void;
  close: () => void;
}

/**
 * Qué tabla de talles está ampliada. Vive en un store porque la abren tanto la
 * sección "Guía de talles" como cada ficha de producto, que son ramas distintas
 * del árbol: pasar la prop obligaría a subir el estado hasta la página.
 */
export const useSizeChartStore = create<SizeChartState>()((set) => ({
  activeId: null,
  open: (id) => set({ activeId: id }),
  close: () => set({ activeId: null }),
}));
