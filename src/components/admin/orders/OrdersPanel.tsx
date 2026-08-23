import { useCallback, useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
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

const NO_ORDERS: Order[] = [];
type StatusFilter = OrderStatus | 'all';

export function OrdersPanel() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
      }),
    [status, debouncedSearch, from, to],
  );

  const { data: orders, error, isLoading, reload, set } = useAsyncResource(loadOrders, NO_ORDERS, [
    loadOrders,
  ]);

  const stats = useMemo(
    () => ({
      total: orders.length,
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
      set((current) => current.map((order) => (order.code === updated.code ? updated : order))),
    [set],
  );

  // La librería de Excel se descarga recién acá, al primer click.
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    setExportError('');
    setIsExporting(true);
    try {
      await exportOrdersToExcel(orders);
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
          <span className={styles.statLabel}>Pedidos en la vista</span>
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
            title="Descarga un Excel con los pedidos, el detalle de items y el resumen por producto"
          >
            {isExporting ? 'Generando…' : 'Exportar Excel'}
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
        <OrderTable orders={orders} onStatusChange={handleStatusChange} />
      )}
    </>
  );
}
