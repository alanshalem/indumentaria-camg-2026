import { Fragment, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  countOrderUnits,
  customerFullName,
  nextStatus,
  ORDER_STATUS_LABELS,
  type Order,
} from '@shared/domain/order';
import { formatPhone, whatsappLink } from '@shared/domain/phone';
import { errorMessage } from '@/services/apiError';
import { orderService } from '@/services/orderService';
import { formatDateTime } from '@/utils/formatDate';
import { Alert, EmptyState } from '@/ui';
import styles from './OrderTable.module.css';

interface Props {
  orders: readonly Order[];
  onStatusChange: (order: Order) => void;
}

export function OrderTable({ orders, onStatusChange }: Props) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function toggleStatus(order: Order) {
    setError('');
    setPendingCode(order.code);
    try {
      onStatusChange(await orderService.updateStatus(order.code, nextStatus(order.status)));
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo actualizar el estado.'));
    } finally {
      setPendingCode(null);
    }
  }

  if (orders.length === 0) {
    return <EmptyState title="No hay pedidos que coincidan con los filtros." />;
  }

  return (
    <>
      {error && <Alert>{error}</Alert>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Socio</th>
              <th>Contacto</th>
              <th className={styles.right}>Items</th>
              <th className={styles.right}>Total</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isOpen = expandedCode === order.code;
              const saved = order.subtotal - order.total;
              return (
                <Fragment key={order.code}>
                  <tr className={styles.row}>
                    <td className={styles.code}>{order.code}</td>
                    <td>{formatDateTime(order.timestamp)}</td>
                    <td>{customerFullName(order)}</td>
                    <td>
                      {/* El club cobra por WhatsApp: un click, sin copiar números. */}
                      {order.phone ? (
                        <a
                          className={styles.phone}
                          href={whatsappLink(order.phone)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {formatPhone(order.phone)}
                        </a>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.right}>{countOrderUnits(order.items)}</td>
                    <td className={styles.right}>
                      {formatPrice(order.total)}
                      {saved > 0 && <span className={styles.saved}>−{formatPrice(saved)}</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.statusPill} ${styles[order.status]}`}
                        onClick={() => void toggleStatus(order)}
                        disabled={pendingCode === order.code}
                        title="Cambiar estado"
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.expand}
                        onClick={() => setExpandedCode(isOpen ? null : order.code)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? 'Ocultar' : 'Detalle'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={styles.detailRow}>
                      <td colSpan={8}>
                        <ul className={styles.detailList}>
                          {order.items.map((item, index) => (
                            <li key={`${order.code}-${item.productId}-${item.size}-${index}`}>
                              <span className={styles.itemQty}>{item.quantity}×</span>
                              <span className={styles.itemName}>{item.productName}</span>
                              <span className={styles.itemMeta}>
                                Talle {item.size}
                                {item.color && ` · ${item.color}`}
                              </span>
                              <span className={styles.itemPrice}>
                                {formatPrice(item.unitPrice * item.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {order.promotions.length > 0 && (
                          <ul className={styles.promoList}>
                            {order.promotions.map((promotion, index) => (
                              <li key={`${promotion.id}-${index}`}>
                                <span className={styles.promoLabel}>{promotion.label}</span>
                                <span className={styles.promoDetail}>{promotion.detail}</span>
                                <span className={styles.promoAmount}>
                                  −{formatPrice(promotion.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <dl className={styles.meta}>
                          <div>
                            <dt>Subtotal</dt>
                            <dd>{formatPrice(order.subtotal)}</dd>
                          </div>
                          <div>
                            <dt>Total</dt>
                            <dd>{formatPrice(order.total)}</dd>
                          </div>
                          {order.email && (
                            <div>
                              <dt>Email</dt>
                              <dd>
                                <a href={`mailto:${order.email}`}>{order.email}</a>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
