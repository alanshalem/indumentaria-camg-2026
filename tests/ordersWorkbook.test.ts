import { describe, expect, it } from 'vitest';
import type { Order, OrderItem } from '../shared/domain/order';
import { compareSizes } from '../shared/domain/product';
import { buildOrdersWorkbook, summarizeByProduct } from '../src/utils/ordersWorkbook';

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  productId: 'campera-canguro',
  productName: 'Campera Canguro',
  size: 'M',
  sizeTier: 'large',
  color: null,
  quantity: 1,
  unitPrice: 54000,
  ...overrides,
});

let sequence = 0;
const order = (items: OrderItem[], overrides: Partial<Order> = {}): Order => {
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  sequence += 1;
  return {
    code: `CAMG-2026-A${sequence}`,
    timestamp: Date.UTC(2026, 7, 22, 12, 0, 0),
    customerName: 'Ana',
    customerLastName: 'Pérez',
    phone: '1123456789',
    email: null,
    items,
    subtotal,
    promotions: [],
    total: subtotal,
    status: 'pending',
    ...overrides,
  };
};

describe('compareSizes', () => {
  it('ordena los numéricos antes que los de letra', () => {
    expect(['M', '10', 'XS', '6', '3XL', '14'].sort(compareSizes)).toEqual([
      '6',
      '10',
      '14',
      'XS',
      'M',
      '3XL',
    ]);
  });

  it('ordena los numéricos por valor y no como texto', () => {
    // El orden alfabético pondría "10" antes que "6" y el export parecería roto.
    expect(['10', '6', '12', '8'].sort(compareSizes)).toEqual(['6', '8', '10', '12']);
  });

  it('trata 16/XS y los rangos de medias como numéricos', () => {
    expect(['S', '16/XS'].sort(compareSizes)).toEqual(['16/XS', 'S']);
    expect(['42-50', '38-42'].sort(compareSizes)).toEqual(['38-42', '42-50']);
  });

  it('NO toma 3XL ni 2XL como numéricos aunque empiecen con dígito', () => {
    expect(['3XL', '6', '2XL', '10'].sort(compareSizes)).toEqual(['6', '10', '2XL', '3XL']);
  });

  it('cae en orden alfabético para talles desconocidos', () => {
    expect(['Único', 'Otro'].sort(compareSizes)).toEqual(['Otro', 'Único']);
  });
});

describe('summarizeByProduct', () => {
  it('suma las unidades del mismo producto, talle y color entre pedidos', () => {
    const summary = summarizeByProduct([
      order([item({ size: 'M', quantity: 2 })]),
      order([item({ size: 'M', quantity: 3 })]),
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ size: 'M', units: 5, amount: 54000 * 5 });
  });

  it('separa filas por talle', () => {
    const summary = summarizeByProduct([
      order([item({ size: 'M' }), item({ size: 'L' })]),
    ]);

    // Orden de prenda, no alfabético: M va antes que L.
    expect(summary.map((row) => row.size)).toEqual(['M', 'L']);
  });

  it('separa filas por color', () => {
    const summary = summarizeByProduct([
      order([
        item({ productId: 'remera', productName: 'Remera', color: 'Roja' }),
        item({ productId: 'remera', productName: 'Remera', color: 'Negra' }),
      ]),
    ]);

    expect(summary.map((row) => row.color)).toEqual(['Negra', 'Roja']);
  });

  it('usa el precio de cada línea, no uno solo del producto', () => {
    // Mismo producto en dos tramos de talle: el importe tiene que respetar cada uno.
    const summary = summarizeByProduct([
      order([
        item({ size: '12', sizeTier: 'small', unitPrice: 48500, quantity: 2 }),
        item({ size: 'XL', sizeTier: 'large', unitPrice: 54000, quantity: 1 }),
      ]),
    ]);

    expect(summary).toEqual([
      expect.objectContaining({ size: '12', units: 2, amount: 97000 }),
      expect.objectContaining({ size: 'XL', units: 1, amount: 54000 }),
    ]);
  });

  it('ordena por producto y después por talle', () => {
    const summary = summarizeByProduct([
      order([
        item({ productId: 'pantalon', productName: 'Pantalón', size: 'M' }),
        item({ productId: 'campera-canguro', productName: 'Campera', size: 'XL' }),
        item({ productId: 'campera-canguro', productName: 'Campera', size: '8' }),
      ]),
    ]);

    expect(summary.map((row) => `${row.productName} ${row.size}`)).toEqual([
      'Campera 8',
      'Campera XL',
      'Pantalón M',
    ]);
  });

  it('sin pedidos devuelve una lista vacía', () => {
    expect(summarizeByProduct([])).toEqual([]);
  });
});

describe('buildOrdersWorkbook', () => {
  const orders = [
    order([item({ size: 'M', quantity: 2 }), item({ size: '10', quantity: 1, unitPrice: 48500 })]),
  ];

  it('arma las tres hojas', () => {
    expect(buildOrdersWorkbook(orders).map((sheet) => sheet.sheet)).toEqual([
      'Pedidos',
      'Items',
      'Resumen por producto',
    ]);
  });

  it('cada hoja tiene tantas columnas declaradas como celdas en su encabezado', () => {
    for (const sheet of buildOrdersWorkbook(orders)) {
      expect(sheet.columns).toHaveLength(sheet.data[0]!.length);
    }
  });

  it('la hoja de items tiene una fila por línea de pedido, más encabezado y totales', () => {
    const items = buildOrdersWorkbook(orders)[1]!;
    expect(items.data).toHaveLength(1 + 2 + 1);
  });

  it('respeta el nombre máximo de hoja que admite Excel', () => {
    for (const sheet of buildOrdersWorkbook(orders)) {
      expect(sheet.sheet.length).toBeLessThanOrEqual(31);
    }
  });

  it('no rompe con una lista vacía: sólo encabezados', () => {
    for (const sheet of buildOrdersWorkbook([])) {
      expect(sheet.data).toHaveLength(1);
    }
  });
});
