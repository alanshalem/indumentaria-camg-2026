import { Fragment, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  countOrderUnits,
  customerFullName,
  hasBackorder,
  isBackordered,
  isCancelled,
  ORDER_STAGES,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
} from '@shared/domain/order';
import { EMAIL_KIND_LABELS, emailKindForStatus } from '@shared/domain/orderEmails';
import { describeUpdate } from './statusNotice';
import { OrderEmailHistory } from './OrderEmailHistory';
import { formatPhone, whatsappLink } from '@shared/domain/phone';
import { ON_DEMAND_LEAD_TIME } from '@shared/domain/stock';
import { errorMessage } from '@/services/apiError';
import { orderService } from '@/services/orderService';
import { formatOrderDate } from '@/utils/formatDate';
import { Alert, Button, EmptyState, Modal } from '@/ui';
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
/** `CAMG-2026-` — lo que comparten todos los códigos y no distingue ninguno. */
const codePrefix = (code: string) => code.slice(0, code.lastIndexOf('-') + 1);
const codeSuffix = (code: string) => code.slice(code.lastIndexOf('-') + 1);

const STATUS_HELP = ORDER_STAGES.map((status) => {
  const kind = emailKindForStatus(status);
  return `${ORDER_STATUS_LABELS[status]} → ${kind ? `mail "${EMAIL_KIND_LABELS[kind]}"` : 'no manda mail'}`;
}).join('\n');

export function OrderTable({ orders, onStatusChange }: Props) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Eliminar es destructivo y la fila es angosta: se confirma en un diálogo
  // que dice de qué pedido se trata.
  const [confirming, setConfirming] = useState<Order | null>(null);

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

      <Modal
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Eliminar pedido"
      >
        {confirming && (
          <div className={styles.confirm}>
            <p>
              El pedido <strong>{confirming.code}</strong> de{' '}
              <strong>{customerFullName(confirming)}</strong> por{' '}
              <strong>{formatPrice(confirming.total)}</strong> deja de contar en los totales y sale
              del listado.
            </p>
            <p className={styles.confirmNote}>
              No se borra de la base: queda como «Eliminado» y lo podés restaurar filtrando por ese
              estado. Al socio no le llega ningún mail.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const target = confirming;
                  setConfirming(null);
                  void changeStatus(target, 'cancelled');
                }}
              >
                Eliminar pedido
              </Button>
            </div>
          </div>
        )}
      </Modal>
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
                    <td className={styles.code}>
                      {/* El prefijo se repite en todas las filas: se atenúa
                          para que el ojo vaya a lo que distingue al pedido. */}
                      <span className={styles.codePrefix}>{codePrefix(order.code)}</span>
                      {codeSuffix(order.code)}
                      {/* Que el club vea de un vistazo qué pedidos tienen algo
                          encargado y no dependa de abrir el detalle. */}
                      {hasBackorder(order) && (
                        <span
                          className={styles.backorder}
                          title={`Tiene prendas a pedido · entrega ${ON_DEMAND_LEAD_TIME}`}
                        >
                          A pedido
                        </span>
                      )}
                    </td>
                    <td className={styles.date} title={formatOrderDate(order.timestamp).title}>
                      {formatOrderDate(order.timestamp).label}
                    </td>
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
                      {/* Un pedido eliminado no está en ninguna etapa: en vez
                          del selector va la marca, con la opción de restaurar. */}
                      {isCancelled(order.status) ? (
                        <span className={`${styles.statusTag} ${styles.cancelled}`}>
                          {ORDER_STATUS_LABELS.cancelled}
                        </span>
                      ) : (
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
                          {ORDER_STAGES.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.expand}
                          onClick={() => setExpandedCode(isOpen ? null : order.code)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Ocultar' : 'Detalle'}
                        </button>

                        {isCancelled(order.status) ? (
                          <button
                            type="button"
                            className={styles.restore}
                            onClick={() => void changeStatus(order, 'pending')}
                            disabled={pendingCode === order.code}
                            title="Vuelve al circuito como «Pendiente de pago»"
                          >
                            Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.trash}
                            onClick={() => setConfirming(order)}
                            disabled={pendingCode === order.code}
                            aria-label={`Eliminar el pedido ${order.code}`}
                            title="Eliminar este pedido"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
                            </svg>
                          </button>
                        )}
                      </div>
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
                                {isBackordered(item) && (
                                  <em className={styles.itemBackorder}>
                                    {item.backorderedUnits} a pedido · {ON_DEMAND_LEAD_TIME}
                                  </em>
                                )}
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
