import { useCallback, useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  countOrderUnits,
  customerFullName,
  describeItem,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '@shared/domain/order';
import { formatPhone } from '@shared/domain/phone';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { orderService } from '@/services/orderService';
import { endOfDayIso, startOfDayIso } from '@/utils/formatDate';
import { downloadCsv, toCsv, type CsvColumn } from '@/utils/exportCsv';
import { Alert, Button, Field, SelectField, Spinner } from '@/ui';
import { OrderTable } from './OrderTable';
import styles from '../Dashboard.module.css';

const NO_ORDERS: Order[] = [];
type StatusFilter = OrderStatus | 'all';

const CSV_COLUMNS: readonly CsvColumn<Order>[] = [
  { header: 'codigo', value: (order) => order.code },
  { header: 'fecha', value: (order) => new Date(order.timestamp).toISOString() },
  { header: 'socio', value: customerFullName },
  { header: 'telefono', value: (order) => formatPhone(order.phone) },
  { header: 'email', value: (order) => order.email ?? '' },
  { header: 'items', value: (order) => order.items.map(describeItem).join(' | ') },
  { header: 'unidades', value: (order) => countOrderUnits(order.items) },
  { header: 'subtotal', value: (order) => order.subtotal },
  {
    header: 'promociones',
    value: (order) =>
      order.promotions.map((promotion) => `${promotion.label} (-${promotion.amount})`).join(' | '),
  },
  { header: 'descuento', value: (order) => order.subtotal - order.total },
  { header: 'total', value: (order) => order.total },
  { header: 'estado', value: (order) => ORDER_STATUS_LABELS[order.status] },
];

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
      pending: orders.filter((order) => order.status === 'pending').length,
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

  const exportCsv = () =>
    downloadCsv(`camg-pedidos-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(orders, CSV_COLUMNS));

  return (
    <>
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pedidos en la vista</span>
          <strong className={styles.statVal}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pendientes</span>
          <strong className={styles.statVal}>{stats.pending}</strong>
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
          <Button variant="ghost" onClick={exportCsv} disabled={orders.length === 0}>
            Exportar CSV
          </Button>
          <Button variant="ghost" onClick={() => void reload()}>
            Actualizar
          </Button>
        </div>
      </section>

      {error && <Alert>{error}</Alert>}

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
