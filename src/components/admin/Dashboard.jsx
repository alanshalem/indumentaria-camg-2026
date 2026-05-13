import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readOrders } from '../../utils/storage.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatPrice } from '../../utils/formatters.js';
import OrderTable from './OrderTable.jsx';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  function reload() {
    setOrders(readOrders());
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1 : null;
    return orders.filter(o => {
      if (statusFilter !== 'all' && (o.status || 'pending') !== statusFilter) return false;
      if (fromTs && o.timestamp < fromTs) return false;
      if (toTs && o.timestamp > toTs) return false;
      if (q) {
        const hay = `${o.code} ${o.customerName} ${o.customerLastName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, query, dateFrom, dateTo, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => (o.status || 'pending') === 'pending').length;
    const revenue = orders.reduce((a, o) => a + (o.total || 0), 0);
    return { total, pending, revenue };
  }, [orders]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function exportCsv() {
    const headers = ['code', 'date', 'customer', 'items', 'total', 'status'];
    const rows = filtered.map(o => [
      o.code,
      new Date(o.timestamp).toISOString(),
      `${o.customerName} ${o.customerLastName}`,
      o.items.map(i => `${i.quantity}x ${i.productName} (${i.size})`).join(' | '),
      o.total || 0,
      o.status || 'pending',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camg-pedidos-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src="/images/logo-club.png" alt="" />
          <div>
            <span className={styles.brandSub}>Panel administrativo</span>
            <h1 className={styles.brandTitle}>Pedidos CAMG</h1>
          </div>
        </div>
        <div className={styles.topActions}>
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>Exportar CSV</button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pedidos totales</span>
          <strong className={styles.statVal}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pendientes</span>
          <strong className={styles.statVal}>{stats.pending}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total facturado</span>
          <strong className={styles.statVal}>{formatPrice(stats.revenue)}</strong>
        </div>
      </section>

      <section className={styles.filters}>
        <div className={styles.filterField}>
          <label>Buscar</label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Código, nombre o apellido"
          />
        </div>
        <div className={styles.filterField}>
          <label>Estado</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="delivered">Entregados</option>
          </select>
        </div>
        <div className={styles.filterField}>
          <label>Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className={styles.filterField}>
          <label>Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </section>

      <OrderTable orders={filtered} onChange={reload} />
    </div>
  );
}
