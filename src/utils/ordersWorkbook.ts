import type { Row, SheetData } from 'write-excel-file/browser';
import {
  countOrderUnits,
  customerFullName,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderItem,
} from '@shared/domain/order.js';
import { formatPhone } from '@shared/domain/phone.js';
import { compareSizes, SIZE_TIER_LABELS } from '@shared/domain/product.js';

/**
 * Arma el libro de Excel de pedidos.
 *
 * Es todo función pura y sin dependencias de red o DOM: la parte que puede
 * estar mal —la agregación por producto— se testea sin abrir un archivo.
 * La descarga vive aparte, en `services/exportOrders.ts`.
 */

// Paleta pensada para el papel, no para la app: el Excel se ve sobre blanco.
const RED = '#DC143C';
const WHITE = '#FFFFFF';
const INK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const ZEBRA = '#FAFAFA';
const TOTALS_BG = '#F3F4F6';

const MONEY = '"$"#,##0';
const DATE_TIME = 'dd/mm/yyyy hh:mm';

const STATUS_STYLE = {
  pending: { textColor: '#B45309', backgroundColor: '#FEF3C7' },
  delivered: { textColor: '#166534', backgroundColor: '#DCFCE7' },
} as const;

/** El paquete no exporta el tipo de columna, así que se declara acá. */
interface ColumnWidth {
  width: number;
}

export interface WorkbookSheet {
  sheet: string;
  data: SheetData;
  columns: ColumnWidth[];
}

/** Una fila del resumen: cuántas unidades de cada producto/talle/color se pidieron. */
export interface ProductSummaryRow {
  productId: string;
  productName: string;
  size: string;
  color: string | null;
  units: number;
  amount: number;
}

// ---------------------------------------------------------------------------
//  Celdas
// ---------------------------------------------------------------------------

const headerCell = (value: string, align?: 'left' | 'right' | 'center'): Row[number] => ({
  value,
  type: String,
  fontWeight: 'bold',
  textColor: WHITE,
  backgroundColor: RED,
  align: align ?? 'left',
  alignVertical: 'center',
  height: 22,
});

const headerRow = (labels: readonly (readonly [string, 'left' | 'right' | 'center'])[]): Row =>
  labels.map(([label, align]) => headerCell(label, align));

const base = (index: number) => ({
  backgroundColor: index % 2 === 1 ? ZEBRA : WHITE,
  bottomBorderColor: LINE,
  bottomBorderStyle: 'thin' as const,
  textColor: INK,
});

const text = (value: string, index: number, extra: Record<string, unknown> = {}): Row[number] => ({
  ...base(index),
  value,
  type: String,
  ...extra,
});

const money = (value: number, index: number, extra: Record<string, unknown> = {}): Row[number] => ({
  ...base(index),
  value,
  type: Number,
  format: MONEY,
  align: 'right',
  ...extra,
});

const count = (value: number, index: number): Row[number] => ({
  ...base(index),
  value,
  type: Number,
  align: 'right',
});

const totalsCell = (value: string | number, isMoney: boolean): Row[number] => ({
  value,
  type: typeof value === 'number' ? Number : String,
  fontWeight: 'bold',
  backgroundColor: TOTALS_BG,
  textColor: INK,
  topBorderColor: MUTED,
  topBorderStyle: 'medium',
  align: typeof value === 'number' ? 'right' : 'left',
  ...(isMoney ? { format: MONEY } : {}),
});

/** Fila de totales alineada a las columnas: `null` deja la celda vacía con estilo. */
const totalsRow = (cells: readonly (string | number | null)[], moneyAt: readonly number[]): Row =>
  cells.map((value, index) =>
    value === null ? totalsCell('', false) : totalsCell(value, moneyAt.includes(index)),
  );

// ---------------------------------------------------------------------------
//  Hoja 1 · Pedidos
// ---------------------------------------------------------------------------

function ordersSheet(orders: readonly Order[]): WorkbookSheet {
  const data: SheetData = [
    headerRow([
      ['Código', 'left'],
      ['Fecha', 'left'],
      ['Socio', 'left'],
      ['Teléfono', 'left'],
      ['Email', 'left'],
      ['Unidades', 'right'],
      ['Subtotal', 'right'],
      ['Descuento', 'right'],
      ['Total', 'right'],
      ['Estado', 'center'],
    ]),
  ];

  orders.forEach((order, index) => {
    const discount = order.subtotal - order.total;
    data.push([
      text(order.code, index, { fontWeight: 'bold' }),
      { ...base(index), value: new Date(order.timestamp), type: Date, format: DATE_TIME },
      text(customerFullName(order), index),
      // Como texto: si fuera número, Excel se come el cero inicial del área.
      text(formatPhone(order.phone), index),
      text(order.email ?? '', index),
      count(countOrderUnits(order.items), index),
      money(order.subtotal, index),
      discount > 0 ? money(-discount, index, { textColor: '#166534' }) : text('', index),
      money(order.total, index, { fontWeight: 'bold' }),
      text(ORDER_STATUS_LABELS[order.status], index, {
        ...STATUS_STYLE[order.status],
        align: 'center',
        fontWeight: 'bold',
      }),
    ]);
  });

  if (orders.length > 0) {
    const subtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
    const total = orders.reduce((sum, order) => sum + order.total, 0);
    const units = orders.reduce((sum, order) => sum + countOrderUnits(order.items), 0);

    data.push(
      totalsRow(
        [`${orders.length} pedidos`, null, null, null, null, units, subtotal, subtotal - total, total, null],
        [6, 7, 8],
      ),
    );
  }

  return {
    sheet: 'Pedidos',
    data,
    columns: [
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 16 },
      { width: 26 },
      { width: 11 },
      { width: 13 },
      { width: 13 },
      { width: 13 },
      { width: 13 },
    ],
  };
}

// ---------------------------------------------------------------------------
//  Hoja 2 · Items
// ---------------------------------------------------------------------------

function itemsSheet(orders: readonly Order[]): WorkbookSheet {
  const data: SheetData = [
    headerRow([
      ['Código', 'left'],
      ['Fecha', 'left'],
      ['Socio', 'left'],
      ['Teléfono', 'left'],
      ['Producto', 'left'],
      ['Talle', 'left'],
      ['Tramo', 'left'],
      ['Color', 'left'],
      ['Cantidad', 'right'],
      ['Precio unit.', 'right'],
      ['Importe', 'right'],
    ]),
  ];

  let index = 0;
  for (const order of orders) {
    for (const item of order.items) {
      data.push([
        text(order.code, index),
        { ...base(index), value: new Date(order.timestamp), type: Date, format: DATE_TIME },
        text(customerFullName(order), index),
        text(formatPhone(order.phone), index),
        text(item.productName, index, { fontWeight: 'bold' }),
        text(item.size, index),
        text(SIZE_TIER_LABELS[item.sizeTier], index, { textColor: MUTED }),
        text(item.color ?? '', index),
        count(item.quantity, index),
        money(item.unitPrice, index),
        money(item.unitPrice * item.quantity, index),
      ]);
      index += 1;
    }
  }

  if (index > 0) {
    const units = orders.reduce((sum, order) => sum + countOrderUnits(order.items), 0);
    const amount = orders.reduce(
      (sum, order) => sum + order.items.reduce((line, item) => line + item.unitPrice * item.quantity, 0),
      0,
    );
    data.push(
      totalsRow([`${index} líneas`, null, null, null, null, null, null, null, units, null, amount], [10]),
    );
  }

  return {
    sheet: 'Items',
    data,
    columns: [
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 16 },
      { width: 30 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 11 },
      { width: 13 },
      { width: 13 },
    ],
  };
}

// ---------------------------------------------------------------------------
//  Hoja 3 · Resumen por producto
// ---------------------------------------------------------------------------

const summaryKey = (item: OrderItem) => `${item.productId}|${item.size}|${item.color ?? ''}`;

/**
 * Cuántas unidades hay que pedirle al proveedor de cada producto, talle y color.
 * Es la cuenta que el club haría a mano mirando pedido por pedido.
 */
export function summarizeByProduct(orders: readonly Order[]): ProductSummaryRow[] {
  const rows = new Map<string, ProductSummaryRow>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = summaryKey(item);
      const existing = rows.get(key);

      if (existing) {
        existing.units += item.quantity;
        existing.amount += item.unitPrice * item.quantity;
      } else {
        rows.set(key, {
          productId: item.productId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          units: item.quantity,
          amount: item.unitPrice * item.quantity,
        });
      }
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.productName.localeCompare(b.productName, 'es') ||
      compareSizes(a.size, b.size) ||
      (a.color ?? '').localeCompare(b.color ?? '', 'es'),
  );
}

function summarySheet(orders: readonly Order[]): WorkbookSheet {
  const summary = summarizeByProduct(orders);

  const data: SheetData = [
    headerRow([
      ['Producto', 'left'],
      ['Talle', 'left'],
      ['Color', 'left'],
      ['Unidades', 'right'],
      ['Importe', 'right'],
    ]),
  ];

  summary.forEach((row, index) => {
    data.push([
      text(row.productName, index, { fontWeight: 'bold' }),
      text(row.size, index),
      text(row.color ?? '', index),
      count(row.units, index),
      money(row.amount, index),
    ]);
  });

  if (summary.length > 0) {
    const units = summary.reduce((sum, row) => sum + row.units, 0);
    const amount = summary.reduce((sum, row) => sum + row.amount, 0);
    data.push(totalsRow(['Total a pedir', null, null, units, amount], [4]));
  }

  return {
    sheet: 'Resumen por producto',
    data,
    columns: [{ width: 32 }, { width: 12 }, { width: 16 }, { width: 12 }, { width: 14 }],
  };
}

// ---------------------------------------------------------------------------

/** Las tres hojas del libro, en el orden en que conviene leerlas. */
export function buildOrdersWorkbook(orders: readonly Order[]): WorkbookSheet[] {
  return [ordersSheet(orders), itemsSheet(orders), summarySheet(orders)];
}
