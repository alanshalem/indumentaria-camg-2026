import { Fragment, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  countOrderUnits,
  customerFullName,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
} from '@shared/domain/order';
import { EMAIL_KIND_LABELS, emailKindForStatus } from '@shared/domain/orderEmails';
import { describeUpdate } from './statusNotice';
import { OrderEmailHistory } from './OrderEmailHistory';
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

/**
 * Qué mail dispara cada estado, en el tooltip del selector.
 *
 * Va la tabla completa y no sólo el estado actual: la duda del admin es "si
 * elijo este otro, ¿le llega algo?", y eso no se puede contestar mirando una
 * sola fila.
 */
const STATUS_HELP = ORDER_STATUSES.map((status) => {
  const kind = emailKindForStatus(status);
  return `${ORDER_STATUS_LABELS[status]} → ${kind ? `mail "${EMAIL_KIND_LABELS[kind]}"` : 'no manda mail'}`;
}).join('\n');

export function OrderTable({ orders, onStatusChange }: Props) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function changeStatus(order: Order, status: OrderStatus) {
    if (status === order.status) return;
    setError('');
    setNotice('');
    setPendingCode(order.code);
    try {
      // El servidor decide si corresponde mandar mail y evita duplicados;
      // acá sólo se muestra lo que informó que hizo.
      const update = await orderService.updateStatus(order.code, status);
      onStatusChange(update.order);

      const described = describeUpdate(update);
      if (described.tone === 'error') setError(described.text);
      else setNotice(described.text);
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
      {notice && <Alert tone="success">{notice}</Alert>}
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
                      <select
                        className={`${styles.statusSelect} ${styles[order.status]}`}
                        value={order.status}
                        disabled={pendingCode === order.code}
                        onChange={(event) =>
                          void changeStatus(order, event.target.value as OrderStatus)
                        }
                        aria-label={`Estado del pedido ${order.code}`}
                        title={STATUS_HELP}
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
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

                        {/* Se pide recién al desplegar: no tiene sentido traer
                            el historial de cien pedidos que nadie va a abrir. */}
                        <OrderEmailHistory code={order.code} />
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
