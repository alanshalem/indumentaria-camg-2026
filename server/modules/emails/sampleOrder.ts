import type { Order } from '../../../shared/domain/order.js';
import type { OrderStatus } from '../../../shared/domain/order.js';

/**
 * Pedido inventado para previsualizar las plantillas.
 *
 * Tiene a propósito todo lo que suele romper un mail: un nombre con acento, dos
 * líneas con talles de distinto tramo, un color y una promoción aplicada. Si se
 * ve bien con esto, se ve bien con cualquier pedido real.
 *
 * El código no existe en la base: es sólo para mirar, y el link firmado que se
 * genera no abre ningún pedido.
 */
export const sampleOrder = (status: OrderStatus): Order => ({
  code: 'CAMG-2026-EJEMP',
  timestamp: Date.UTC(2026, 8, 7, 18, 14, 0),
  customerName: 'María José',
  customerLastName: 'Giménez',
  phone: '1123456789',
  email: 'socio@ejemplo.com',
  items: [
    {
      productId: 'campera-canguro',
      productName: 'Campera Canguro CAMG',
      size: 'XL',
      sizeTier: 'large',
      color: null,
      quantity: 1,
      unitPrice: 54000,
      backorderedUnits: 0,
      delivered: false,
    },
    {
      productId: 'remera-algodon',
      productName: 'Remera de algodón CAMG',
      size: '12',
      sizeTier: 'small',
      color: 'Roja',
      quantity: 2,
      unitPrice: 20500,
      // Una línea a pedido: el ejemplo muestra cómo se ve el aviso de plazo.
      backorderedUnits: 1,
      delivered: false,
    },
  ],
  subtotal: 95000,
  promotions: [
    {
      id: 'familia-camg',
      kind: 'sameProductDifferentSize',
      label: 'Promo familia CAMG',
      detail: 'Remera de algodón CAMG: talles 12 y 12',
      amount: 2050,
    },
  ],
  total: 92950,
  status,
  paymentMethod: null,
  paymentLink: null,
});
