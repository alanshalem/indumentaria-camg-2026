import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { OrderPage } from '@shared/api/contracts';
import { ORDERS_PAGE_SIZE } from '@shared/schemas/order.schema';
import {
  isOpenOrder,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '@shared/domain/order';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { errorMessage } from '@/services/apiError';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { orderService } from '@/services/orderService';
import { endOfDayIso, startOfDayIso } from '@/utils/formatDate';
import { exportOrdersToExcel } from '@/services/exportOrders';
import { Alert, Button, Field, SelectField, Spinner } from '@/ui';
import { OrderTable } from './OrderTable';
import styles from '../Dashboard.module.css';

const NO_PAGE: OrderPage = { orders: [], total: 0 };
type StatusFilter = OrderStatus | 'all';

const shortDate = (value: string) => value.split('-').reverse().join('/');

/**
 * Cómo describir el recorte exportado, en el idioma del admin.
 *
 * Va impreso arriba de cada hoja y en el nombre del archivo: sin esto, dos
 * exportaciones del mismo día se pisaban en la carpeta de descargas y por
 * dentro eran indistinguibles.
 */
export function describeFilter(filters: {
  status: StatusFilter;
  search: string;
  from: string;
  to: string;
}): string {
  const partes = [
    filters.status === 'all' ? 'Todos los pedidos' : ORDER_STATUS_LABELS[filters.status],
    filters.search ? `que coinciden con "${filters.search}"` : '',
    filters.from && filters.to
      ? `del ${shortDate(filters.from)} al ${shortDate(filters.to)}`
      : filters.from
        ? `desde el ${shortDate(filters.from)}`
        : filters.to
          ? `hasta el ${shortDate(filters.to)}`
          : '',
  ];

  return partes.filter(Boolean).join(' ');
}

export function OrdersPanel() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search);

  // Los filtros se resuelven en Postgres, no en memoria: el panel sigue siendo
  // usable con miles de pedidos en vez de traerlos todos y descartarlos acá.
  const loadOrders = useCallback(
    () =>
      orderService.list({
        ...(status !== 'all' ? { status } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(startOfDayIso(from) ? { from: startOfDayIso(from) } : {}),
        ...(endOfDayIso(to) ? { to: endOfDayIso(to) } : {}),
        limit: ORDERS_PAGE_SIZE,
        offset: page * ORDERS_PAGE_SIZE,
      }),
    [status, debouncedSearch, from, to, page],
  );

  const { data: pageData, error, isLoading, reload, set } = useAsyncResource(loadOrders, NO_PAGE, [
    loadOrders,
  ]);

  const orders = pageData.orders;

  // Cambiar cualquier filtro vuelve a la primera página: si no, un filtro que
  // devuelve pocos resultados se veía vacío por estar parado en la página 3.
  useEffect(() => setPage(0), [status, debouncedSearch, from, to]);

  const lastPage = Math.max(0, Math.ceil(pageData.total / ORDERS_PAGE_SIZE) - 1);

  const stats = useMemo(
    () => ({
      total: pageData.total,
      open: orders.filter((order) => isOpenOrder(order.status)).length,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      discounts: orders.reduce((sum, order) => sum + (order.subtotal - order.total), 0),
    }),
    [orders],
  );

  // Actualización optimista: el cambio de estado se ve al instante y la fila
  // queda sincronizada con lo que devolvió el servidor, sin recargar la tabla.
  const handleStatusChange = useCallback(
    (updated: Order) =>
      set((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.code === updated.code ? updated : order)),
      })),
    [set],
  );

  // La librería de Excel se descarga recién acá, al primer click.
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const filterLabel = useMemo(
    () => describeFilter({ status, search: debouncedSearch, from, to }),
    [status, debouncedSearch, from, to],
  );

  async function handleExport() {
    setExportError('');
    setIsExporting(true);
    try {
      await exportOrdersToExcel(orders, { filterLabel, generatedAt: new Date() });
    } catch (caught) {
      setExportError(errorMessage(caught, 'No se pudo generar el Excel.'));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pedidos con este filtro</span>
          <strong className={styles.statVal}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Sin entregar</span>
          <strong className={styles.statVal}>{stats.open}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total facturado</span>
          <strong className={styles.statVal}>{formatPrice(stats.revenue)}</strong>
          {stats.discounts > 0 && (
            <span className={styles.statHint}>{formatPrice(stats.discounts)} en promos</span>
          )}
        </div>
      </section>

      <section className={styles.filters}>
        <Field
          label="Buscar"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Código, nombre, apellido o teléfono"
        />
        <SelectField
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
        >
          <option value="all">Todos</option>
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {ORDER_STATUS_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <Field label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Field label="Hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <div className={styles.filterActions}>
          <Button
            variant="ghost"
            onClick={() => void handleExport()}
            disabled={orders.length === 0}
            loading={isExporting}
            title={`Descarga un Excel con estos ${orders.length} pedidos: el listado, el detalle de items y el resumen de lo que hay que encargar. Recorte: ${filterLabel}`}
          >
            {/* Dice cuántos: el botón exporta lo filtrado, no todo el histórico. */}
            {isExporting ? 'Generando…' : `Exportar Excel (${orders.length})`}
          </Button>
          <Button variant="ghost" onClick={() => void reload()}>
            Actualizar
          </Button>
        </div>
      </section>

      {(error || exportError) && <Alert>{exportError || error}</Alert>}

      {isLoading && orders.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size={26} label="Cargando pedidos…" />
        </div>
      ) : (
        <>
          <OrderTable orders={orders} onStatusChange={handleStatusChange} />

          {/* Sin esto la tabla renderizaba cientos de filas de una sola vez. */}
          {lastPage > 0 && (
            <nav className={styles.pager} aria-label="Páginas de pedidos">
              <Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ← Anteriores
              </Button>
              <span className={styles.pagerLabel}>
                Página {page + 1} de {lastPage + 1} · {pageData.total} pedidos
              </span>
              <Button
                variant="ghost"
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
              >
                Siguientes →
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
