import type { Order } from '../../shared/domain/order';
import type { Product } from '../../shared/domain/product';

/**
 * Datos de ejemplo compartidos por los tests.
 *
 * Estaban declarados dentro de cada archivo que los usaba. Mientras fuera uno
 * solo funcionaba; el problema era el incentivo: escribir el primer test de un
 * servicio nuevo arrancaba por rearmar un producto y un pedido enteros, y ese
 * costo de entrada es la razón por la que había servicios sin ningún test.
 *
 * Todo entra por `overrides`, así cada caso dice en una línea qué le importa y
 * el resto es ruido que no tiene que escribir.
 */
export const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'campera-canguro',
  name: 'Campera Canguro CAMG',
  description: '',
  imageUrl: '/images/fotos-prendas/campera.jpg',
  sizesSmall: ['6', '8', '10', '12', '14'],
  sizesLarge: ['16/XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  priceSmall: 48500,
  priceLarge: 54000,
  colors: [],
  sizeChartId: 'buzos',
  category: 'abrigo',
  stock: [],
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/** Lo que manda el checkout. Nunca lleva precios: los pone el servidor. */
export const CUSTOMER = {
  customerName: 'Ana',
  customerLastName: 'Pérez',
  phone: '1123456789',
  email: 'ana@ejemplo.com',
  paymentMethod: 'mercadopago' as const,
};

/**
 * Un pedido ya guardado, con dos líneas y una promo aplicada: es la forma que
 * ejercita los mails y las plantillas sin quedarse en el caso trivial.
 */
export const order = (overrides: Partial<Order> = {}): Order => ({
  code: 'CAMG-2026-ABCDE',
  timestamp: Date.UTC(2026, 7, 22, 15, 0, 0),
  customerName: 'Ana María',
  customerLastName: 'Pérez',
  phone: '1123456789',
  email: 'ana@ejemplo.com',
  items: [
    {
      productId: 'campera-canguro',
      productName: 'Campera Canguro CAMG',
      size: 'M',
      sizeTier: 'large',
      color: null,
      quantity: 2,
      unitPrice: 54000,
      backorderedUnits: 0,
      delivered: false,
    },
    {
      productId: 'remera-algodon',
      productName: 'Remera de algodón',
      size: '12',
      sizeTier: 'small',
      color: 'Roja',
      quantity: 1,
      unitPrice: 20500,
      backorderedUnits: 0,
      delivered: false,
    },
  ],
  subtotal: 128500,
  promotions: [
    {
      id: 'familia-camg',
      kind: 'sameProductDifferentSize',
      label: 'Promo familia CAMG',
      detail: 'Remera: talles 12 y M',
      amount: 2050,
    },
  ],
  total: 126450,
  status: 'pending',
  paymentMethod: null,
  paymentLink: null,
  ...overrides,
});
