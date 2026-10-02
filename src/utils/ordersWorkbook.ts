import type { Row, SheetData } from 'write-excel-file/browser';
import {
  countOrderUnits,
  countsForBilling,
  customerFullName,
  isConfirmed,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@shared/domain/order';
import { formatPhone } from '@shared/domain/phone';
import { CLUB } from '@shared/domain/club';
import { compareSizes, SIZE_TIER_LABELS } from '@shared/domain/product';

/**
 * Arma el libro de Excel de pedidos.
 *
 * Es todo función pura y sin dependencias de red o DOM: la parte que puede
 * estar mal —la agregación por producto— se testea sin abrir un archivo.
 * La descarga vive aparte, en `services/exportOrders.ts`.
 *
 * El club imprime esto y se lo lleva al proveedor, así que las hojas salen
 * apaisadas, sin cuadrícula y con el filtro aplicado escrito arriba: dos
 * exportaciones distintas tienen que poder distinguirse en papel.
 */

// Paleta pensada para el papel, no para la app: el Excel se ve sobre blanco.
const RED = '#DC143C';
const WHITE = '#FFFFFF';
const INK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const ZEBRA = '#FAFAFA';
const TOTALS_BG = '#F3F4F6';
const WARN_BG = '#FEF3C7';
const WARN_INK = '#92400E';

const MONEY = '"$"#,##0';
const DATE_TIME = 'dd/mm/yyyy hh:mm';

const STATUS_STYLE: Record<OrderStatus, { textColor: string; backgroundColor: string }> = {
  pending: { textColor: '#B45309', backgroundColor: '#FEF3C7' },
  deposit: { textColor: '#0F766E', backgroundColor: '#CCFBF1' },
  paid: { textColor: '#1D4ED8', backgroundColor: '#DBEAFE' },
  ready: { textColor: '#6D28D9', backgroundColor: '#EDE9FE' },
  delivered: { textColor: '#166534', backgroundColor: '#DCFCE7' },
  cancelled: { textColor: '#7F1D1D', backgroundColor: '#FEE2E2' },
};

/** Los pedidos que entran en el libro: todos menos los eliminados. */
const billable = (orders: readonly Order[]): Order[] =>
  orders.filter((order) => countsForBilling(order.status));

/** Tipos que el paquete no exporta desde su raíz, declarados acá. */
interface ColumnWidth {
  width: number;
}

interface ConditionalFormatting {
  cellRange: { from: { row: number; column: number }; to: { row: number; column: number } };
  condition: { operator: '>' | '>=' | '<' | '<=' | '=' | '!='; value: number };
  style: { backgroundColor?: string; textColor?: string; fontWeight?: 'bold' };
}

export interface WorkbookSheet {
  sheet: string;
  data: SheetData;
  columns: ColumnWidth[];
  /** Apaisado en las hojas anchas: diez columnas no entran en A4 vertical. */
  landscape: boolean;
  /** Filas de encabezado que quedan fijas al scrollear. */
  stickyRowsCount: number;
  stickyColumnsCount?: number;
  conditionalFormatting?: ConditionalFormatting[];
}

/** Qué recorte de pedidos se exportó. Va impreso arriba de cada hoja. */
export interface ExportContext {
  /** Descripción del filtro tal como lo ve el admin. */
  filterLabel: string;
  generatedAt: Date;
}

/** Una fila del resumen: cuántas unidades de cada producto/talle/color se pidieron. */
export interface ProductSummaryRow {
  productId: string;
  productName: string;
  size: string;
  color: string | null;
  /** Unidades de pedidos con el pago acreditado. Es lo que hay que encargar. */
  confirmedUnits: number;
  /** Unidades de pedidos que todavía nadie pagó. */
  unconfirmedUnits: number;
  /** Importe de las unidades confirmadas. */
  confirmedAmount: number;
}

// ---------------------------------------------------------------------------
//  Celdas
// ---------------------------------------------------------------------------

/**
 * Título de la hoja, fusionado a lo ancho. Sin esto, una planilla de seis
 * pedidos puede ser «todo» o «sólo los pendientes de agosto» y por dentro son
 * idénticas.
 */
const titleRows = (sheetName: string, span: number, context: ExportContext): SheetData => [
  [
    {
      value: `${CLUB.name} · ${sheetName}`,
      type: String,
      fontWeight: 'bold',
      fontSize: 14,
      textColor: INK,
      columnSpan: span,
      height: 24,
      alignVertical: 'center',
    },
  ],
  [
    {
      value: `${context.filterLabel} · generado el ${formatStamp(context.generatedAt)}`,
      type: String,
      fontSize: 10,
      textColor: MUTED,
      columnSpan: span,
      height: 16,
      alignVertical: 'center',
    },
  ],
];

const stampFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatStamp = (date: Date) => stampFormatter.format(date);

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

const count = (value: number, index: number, extra: Record<string, unknown> = {}): Row[number] => ({
  ...base(index),
  value,
  type: Number,
  align: 'right',
  ...extra,
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

/** Fila 1 y 2 son el título; la 3 es el encabezado de columnas. */
const TITLE_ROWS = 2;
const HEADER_ROWS = TITLE_ROWS + 1;

// ---------------------------------------------------------------------------
//  Hoja 1 · Pedidos
// ---------------------------------------------------------------------------

function ordersSheet(orders: readonly Order[], context: ExportContext): WorkbookSheet {
  const columns = [
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
  ] as const;

  const data: SheetData = [...titleRows('Pedidos', columns.length, context), headerRow(columns)];

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
    landscape: true,
    stickyRowsCount: HEADER_ROWS,
    stickyColumnsCount: 1,
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

function itemsSheet(orders: readonly Order[], context: ExportContext): WorkbookSheet {
  const columns = [
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
  ] as const;

  const data: SheetData = [...titleRows('Items', columns.length, context), headerRow(columns)];

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
    landscape: true,
    stickyRowsCount: HEADER_ROWS,
    // El código queda a la vista al scrollear a la derecha: sin esto no se sabe
    // de qué pedido es la línea que se está mirando.
    stickyColumnsCount: 1,
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
 *
 * Separa lo pago de lo que todavía nadie confirmó: sumar todo junto hacía que
 * el club encargara y pagara prendas de pedidos que nunca se concretaron.
 */
export function summarizeByProduct(orders: readonly Order[]): ProductSummaryRow[] {
  const rows = new Map<string, ProductSummaryRow>();

  for (const order of billable(orders)) {
    const confirmed = isConfirmed(order.status);

    for (const item of order.items) {
      const key = summaryKey(item);
      const row =
        rows.get(key) ??
        {
          productId: item.productId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          confirmedUnits: 0,
          unconfirmedUnits: 0,
          confirmedAmount: 0,
        };

      if (confirmed) {
        row.confirmedUnits += item.quantity;
        row.confirmedAmount += item.unitPrice * item.quantity;
      } else {
        row.unconfirmedUnits += item.quantity;
      }

      rows.set(key, row);
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.productName.localeCompare(b.productName, 'es') ||
      compareSizes(a.size, b.size) ||
      (a.color ?? '').localeCompare(b.color ?? '', 'es'),
  );
}

function summarySheet(orders: readonly Order[], context: ExportContext): WorkbookSheet {
  const summary = summarizeByProduct(orders);

  const columns = [
    ['Producto', 'left'],
    ['Talle', 'left'],
    ['Color', 'left'],
    ['A encargar', 'right'],
    ['Sin confirmar', 'right'],
    ['Importe confirmado', 'right'],
  ] as const;

  const data: SheetData = [
    ...titleRows('Resumen por producto', columns.length, context),
    headerRow(columns),
  ];

  summary.forEach((row, index) => {
    data.push([
      text(row.productName, index, { fontWeight: 'bold' }),
      text(row.size, index),
      text(row.color ?? '', index),
      count(row.confirmedUnits, index, { fontWeight: 'bold' }),
      count(row.unconfirmedUnits, index),
      money(row.confirmedAmount, index),
    ]);
  });

  if (summary.length > 0) {
    const confirmedUnits = summary.reduce((sum, row) => sum + row.confirmedUnits, 0);
    const unconfirmed = summary.reduce((sum, row) => sum + row.unconfirmedUnits, 0);
    const amount = summary.reduce((sum, row) => sum + row.confirmedAmount, 0);
    data.push(totalsRow(['Total a encargar', null, null, confirmedUnits, unconfirmed, amount], [5]));
  }

  return {
    sheet: 'Resumen por producto',
    data,
    landscape: false,
    stickyRowsCount: HEADER_ROWS,
    // Pinta la columna «Sin confirmar» sólo donde hay algo pendiente: son las
    // filas donde el número «A encargar» de al lado se queda corto a propósito.
    conditionalFormatting:
      summary.length > 0
        ? [
            {
              cellRange: {
                from: { row: HEADER_ROWS + 1, column: 5 },
                to: { row: HEADER_ROWS + summary.length, column: 5 },
              },
              condition: { operator: '>', value: 0 },
              style: { backgroundColor: WARN_BG, textColor: WARN_INK, fontWeight: 'bold' },
            },
          ]
        : [],
    columns: [{ width: 32 }, { width: 12 }, { width: 16 }, { width: 13 }, { width: 15 }, { width: 20 }],
  };
}

// ---------------------------------------------------------------------------

/**
 * Las tres hojas del libro, en el orden en que conviene leerlas.
 *
 * Los pedidos eliminados quedan afuera de todo el libro: esta planilla existe
 * para facturar y para encargarle al proveedor, y un pedido dado de baja no
 * cuenta para ninguna de las dos cosas.
 */
export function buildOrdersWorkbook(
  orders: readonly Order[],
  context: ExportContext,
): WorkbookSheet[] {
  const vivos = billable(orders);

  return [
    ordersSheet(vivos, context),
    itemsSheet(vivos, context),
    summarySheet(vivos, context),
  ];
}
