import { describe, expect, it } from 'vitest';
import type { Order, OrderItem } from '../shared/domain/order';
import { compareSizes } from '../shared/domain/product';
import {
  buildOrdersWorkbook,
  isConfirmed,
  summarizeByProduct,
  type ExportContext,
} from '../src/utils/ordersWorkbook';
import { slugFilter, workbookFileName } from '../src/services/exportOrders';
import type { SheetData } from 'write-excel-file/browser';

/** Los pedidos de los ejemplos nacen 'pending'; el resumen los separa por eso. */
const CONTEXT: ExportContext = {
  filterLabel: 'Todos los pedidos',
  generatedAt: new Date(Date.UTC(2026, 7, 23, 15, 0, 0)),
};

/** La celda como objeto: SheetData admite valores sueltos y acá siempre lo son. */
const cell = (sheet: { data: SheetData }, row: number) =>
  (sheet.data[row]![0] ?? {}) as { value?: unknown; columnSpan?: number };

/** Filas del resumen tal como se leen: lo pago va en confirmedUnits. */
const pagado = (extra: Partial<Order> = {}): Partial<Order> => ({ status: 'paid', ...extra });

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  productId: 'campera-canguro',
  productName: 'Campera Canguro',
  size: 'M',
  sizeTier: 'large',
  backorderedUnits: 0,
  delivered: false,
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
    paymentMethod: null,
    paymentLink: null,
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
      order([item({ size: 'M', quantity: 2 })], pagado()),
      order([item({ size: 'M', quantity: 3 })], pagado()),
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      size: 'M',
      confirmedUnits: 5,
      unconfirmedUnits: 0,
      confirmedAmount: 54000 * 5,
    });
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
      order(
        [
          item({ size: '12', sizeTier: 'small', unitPrice: 48500, quantity: 2 }),
          item({ size: 'XL', sizeTier: 'large', unitPrice: 54000, quantity: 1 }),
        ],
        pagado(),
      ),
    ]);

    expect(summary).toEqual([
      expect.objectContaining({ size: '12', confirmedUnits: 2, confirmedAmount: 97000 }),
      expect.objectContaining({ size: 'XL', confirmedUnits: 1, confirmedAmount: 54000 }),
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
    expect(buildOrdersWorkbook(orders, CONTEXT).map((sheet) => sheet.sheet)).toEqual([
      'Pedidos',
      'Items',
      'Resumen por producto',
    ]);
  });

  it('cada hoja tiene tantas columnas declaradas como celdas en su encabezado', () => {
    // data[0] y data[1] son el titulo fusionado; el encabezado real es data[2].
    for (const sheet of buildOrdersWorkbook(orders, CONTEXT)) {
      expect(sheet.columns).toHaveLength(sheet.data[2]!.length);
    }
  });

  it('la hoja de items tiene una fila por línea de pedido, más encabezado y totales', () => {
    const items = buildOrdersWorkbook(orders, CONTEXT)[1]!;
    expect(items.data).toHaveLength(2 + 1 + 2 + 1);
  });

  it('respeta el nombre máximo de hoja que admite Excel', () => {
    for (const sheet of buildOrdersWorkbook(orders, CONTEXT)) {
      expect(sheet.sheet.length).toBeLessThanOrEqual(31);
    }
  });

  it('no rompe con una lista vacía: sólo encabezados', () => {
    for (const sheet of buildOrdersWorkbook([], CONTEXT)) {
      expect(sheet.data).toHaveLength(2 + 1);
    }
  });
});

describe('resumen: lo que hay que encargarle al proveedor', () => {
  it('no cuenta como encargable un pedido que nadie pago', () => {
    const summary = summarizeByProduct([
      order([item({ size: 'M', quantity: 2 })], { status: 'pending' }),
      order([item({ size: 'M', quantity: 3 })], { status: 'paid' }),
    ]);

    // Sumarlos juntos hacia que el club encargara 5 y pagara 2 de gusto.
    expect(summary[0]).toMatchObject({
      confirmedUnits: 3,
      unconfirmedUnits: 2,
      confirmedAmount: 54000 * 3,
    });
  });

  it('con la seña ya hay compromiso: cuenta como encargable', () => {
    for (const status of ['deposit', 'paid', 'ready', 'delivered'] as const) {
      expect(isConfirmed(status)).toBe(true);
    }
    expect(isConfirmed('pending')).toBe(false);
  });

  it('un pedido eliminado no cuenta como confirmado', () => {
    // Regresion: `status !== 'pending'` daba true para 'cancelled' y el club
    // le encargaba al proveedor una prenda de un pedido dado de baja.
    expect(isConfirmed('cancelled')).toBe(false);
  });

  it('un pedido eliminado no suma unidades ni importe en el resumen', () => {
    const summary = summarizeByProduct([
      order([item({ size: 'M', quantity: 2 })], { status: 'paid' }),
      order([item({ size: 'M', quantity: 5 })], { status: 'cancelled' }),
    ]);

    expect(summary[0]).toMatchObject({
      confirmedUnits: 2,
      unconfirmedUnits: 0,
      confirmedAmount: 54000 * 2,
    });
  });

  it('el importe confirmado ignora lo pendiente', () => {
    const summary = summarizeByProduct([order([item({ quantity: 4 })], { status: 'pending' })]);

    expect(summary[0]).toMatchObject({ confirmedUnits: 0, confirmedAmount: 0, unconfirmedUnits: 4 });
  });
});

describe('nombre del archivo', () => {
  const cuando = new Date(2026, 7, 23, 15, 0, 0);

  it('lleva el filtro para que dos exportaciones del mismo dia no se pisen', () => {
    expect(workbookFileName(slugFilter('Pendiente de pago'), cuando)).toBe(
      'camg-pedidos-2026-08-23-pendiente-de-pago.xlsx',
    );
    expect(workbookFileName(slugFilter('Todos los pedidos'), cuando)).toBe(
      'camg-pedidos-2026-08-23-todos-los-pedidos.xlsx',
    );
  });

  it('saca acentos y comillas: el nombre tiene que sobrevivir a cualquier sistema', () => {
    expect(slugFilter('Listo para retirar que coinciden con "Pérez"')).toBe(
      // Cortado a 40: un nombre de archivo largo no le sirve a nadie.
      'listo-para-retirar-que-coinciden-con-per',
    );
  });

  it('sin filtro no agrega sufijo', () => {
    expect(workbookFileName('', cuando)).toBe('camg-pedidos-2026-08-23.xlsx');
  });
});

describe('encabezado de cada hoja', () => {
  const orders = [order([item()])];

  it('dice el club, la hoja y que recorte se exporto', () => {
    const [pedidos] = buildOrdersWorkbook(orders, {
      filterLabel: 'Pendiente de pago desde el 01/08/2026',
      generatedAt: new Date(Date.UTC(2026, 7, 23, 18, 0, 0)),
    });

    const titulo = String(cell(pedidos!, 0).value);
    const recorte = String(cell(pedidos!, 1).value);

    expect(titulo).toContain('Pedidos');
    expect(recorte).toContain('Pendiente de pago desde el 01/08/2026');
  });

  it('el titulo se fusiona a lo ancho de todas las columnas', () => {
    for (const sheet of buildOrdersWorkbook(orders, CONTEXT)) {
      expect(cell(sheet, 0).columnSpan).toBe(sheet.columns.length);
      expect(sheet.data[0]).toHaveLength(1);
    }
  });

  it('las hojas anchas salen apaisadas y con el codigo fijo', () => {
    const [pedidos, items, resumen] = buildOrdersWorkbook(orders, CONTEXT);

    expect(pedidos!.landscape).toBe(true);
    expect(items!.landscape).toBe(true);
    expect(items!.stickyColumnsCount).toBe(1);
    // El resumen tiene seis columnas: entra en A4 vertical.
    expect(resumen!.landscape).toBe(false);
  });

  it('el encabezado fijo cubre el titulo y los nombres de columna', () => {
    for (const sheet of buildOrdersWorkbook(orders, CONTEXT)) {
      expect(sheet.stickyRowsCount).toBe(3);
    }
  });
});
