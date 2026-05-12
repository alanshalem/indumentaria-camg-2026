import { Fragment, useState } from 'react';
import { formatDate, formatPrice } from '../../utils/formatters.js';
import { updateOrder } from '../../utils/storage.js';
import styles from './OrderTable.module.css';

export default function OrderTable({ orders, onChange }) {
  const [expanded, setExpanded] = useState(null);

  function toggleStatus(order) {
    const next = order.status === 'delivered' ? 'pending' : 'delivered';
    updateOrder(order.code, { status: next });
    onChange();
  }

  if (orders.length === 0) {
    return <p className={styles.empty}>No hay pedidos que coincidan con los filtros.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Fecha</th>
            <th>Socio</th>
            <th className={styles.right}>Items</th>
            <th className={styles.right}>Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const isOpen = expanded === order.code;
            const totalItems = order.items.reduce((a, b) => a + b.quantity, 0);
            return (
              <Fragment key={order.code}>
                <tr className={styles.row}>
                  <td className={styles.code}>{order.code}</td>
                  <td>{formatDate(order.timestamp)}</td>
                  <td>{order.customerName} {order.customerLastName}</td>
                  <td className={styles.right}>{totalItems}</td>
                  <td className={styles.right}>{formatPrice(order.total || 0)}</td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.statusPill} ${order.status === 'delivered' ? styles.delivered : styles.pending}`}
                      onClick={() => toggleStatus(order)}
                    >
                      {order.status === 'delivered' ? 'Entregado' : 'Pendiente'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.expand}
                      onClick={() => setExpanded(isOpen ? null : order.code)}
                    >
                      {isOpen ? 'Ocultar' : 'Detalle'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className={styles.detailRow}>
                    <td colSpan={7}>
                      <ul className={styles.detailList}>
                        {order.items.map((it, i) => (
                          <li key={`${order.code}-${i}`}>
                            <span className={styles.itemQty}>{it.quantity}×</span>
                            <span className={styles.itemName}>{it.productName}</span>
                            <span className={styles.itemMeta}>Talle {it.size} · {it.color}</span>
                            {it.unitPrice != null && (
                              <span className={styles.itemPrice}>
                                {formatPrice(it.unitPrice * it.quantity)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
