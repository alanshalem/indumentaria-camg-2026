import { formatPrice } from '@shared/domain/money';
import {
  countOrderUnits,
  customerFullName,
  deliveredCount,
  hasBackorder,
  isCancelled,
  isPartiallyDelivered,
  ORDER_STAGES,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
} from '@shared/domain/order';
import { EMAIL_KIND_LABELS, emailKindForStatus } from '@shared/domain/orderEmails';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
  type PaymentMethod,
} from '@shared/domain/payment';
import { formatPhone, whatsappLink } from '@shared/domain/phone';
import { ON_DEMAND_LEAD_TIME } from '@shared/domain/stock';
import { formatOrderDate } from '@/utils/formatDate';
import { TrashIcon, WhatsappIcon } from '@/ui/icons';
import styles from './OrderTable.module.css';

/**
 * Qué mail dispara cada estado, en el tooltip del selector.
 *
 * Va la tabla completa y no sólo el estado actual: la duda del admin es "si
 * elijo este otro, ¿le llega algo?", y eso no se puede contestar mirando una
 * sola fila.
 */
const STATUS_HELP = ORDER_STAGES.map((status) => {
  const kind = emailKindForStatus(status);
  return `${ORDER_STATUS_LABELS[status]} → ${kind ? `mail "${EMAIL_KIND_LABELS[kind]}"` : 'no manda mail'}`;
}).join('\n');

/** `CAMG-2026-` — lo que comparten todos los códigos y no distingue ninguno. */
const codePrefix = (code: string) => code.slice(0, code.lastIndexOf('-') + 1);
const codeSuffix = (code: string) => code.slice(code.lastIndexOf('-') + 1);

interface Props {
  order: Order;
  isOpen: boolean;
  /** Esperando al servidor: los controles de esta fila quedan quietos. */
  isBusy: boolean;
  onToggleDetail: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onPaymentChange: (method: PaymentMethod | null) => void;
  onMessages: () => void;
  onDelete: () => void;
}

/** Una fila del listado: el resumen que el club escanea. */
export function OrderRow({
  order,
  isOpen,
  isBusy,
  onToggleDetail,
  onStatusChange,
  onPaymentChange,
  onMessages,
  onDelete,
}: Props) {
  const saved = order.subtotal - order.total;

  return (
    <tr className={styles.row}>
      <td className={styles.code}>
        {/* El prefijo se repite en todas las filas: se atenúa para que el ojo
            vaya a lo que distingue al pedido. */}
        <span className={styles.codePrefix}>{codePrefix(order.code)}</span>
        {codeSuffix(order.code)}
        {/* Que el club vea de un vistazo qué pedidos tienen algo encargado y no
            dependa de abrir el detalle. */}
        {hasBackorder(order) && (
          <span
            className={styles.backorder}
            title={`Tiene prendas a pedido · entrega ${ON_DEMAND_LEAD_TIME}`}
          >
            A pedido
          </span>
        )}
        {/* Entregado a medias: es el dato que el club pierde de vista si sólo
            mira el estado del pedido. */}
        {isPartiallyDelivered(order) && (
          <span className={styles.partial} title="Hay prendas entregadas y prendas pendientes">
            {deliveredCount(order)}/{order.items.length} entregado
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
        <select
          className={`${styles.paymentSelect} ${order.paymentMethod ? styles[order.paymentMethod] : ''}`}
          value={order.paymentMethod ?? ''}
          disabled={isBusy}
          onChange={(event) => onPaymentChange((event.target.value || null) as PaymentMethod | null)}
          aria-label={`Método de pago del pedido ${order.code}`}
          title={`Cómo paga el socio: ${paymentMethodLabel(order.paymentMethod)}`}
        >
          <option value="">Sin definir</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
      </td>

      <td>
        {/* Un pedido eliminado no está en ninguna etapa: en vez del selector va
            la marca, con la opción de restaurar. */}
        {isCancelled(order.status) ? (
          <span className={`${styles.statusTag} ${styles.cancelled}`}>
            {ORDER_STATUS_LABELS.cancelled}
          </span>
        ) : (
          <select
            className={`${styles.statusSelect} ${styles[order.status]}`}
            value={order.status}
            disabled={isBusy}
            onChange={(event) => onStatusChange(event.target.value as OrderStatus)}
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
            className={styles.whatsapp}
            onClick={onMessages}
            disabled={isBusy}
            title={`Mandarle un mensaje a ${customerFullName(order)}`}
            aria-label={`Mensajes de WhatsApp para ${order.code}`}
          >
            <WhatsappIcon />
          </button>

          <button
            type="button"
            className={styles.expand}
            onClick={onToggleDetail}
            aria-expanded={isOpen}
          >
            {isOpen ? 'Ocultar' : 'Detalle'}
          </button>

          {isCancelled(order.status) ? (
            <button
              type="button"
              className={styles.restore}
              onClick={() => onStatusChange('pending')}
              disabled={isBusy}
              title="Vuelve al circuito como «Pendiente de pago»"
            >
              Restaurar
            </button>
          ) : (
            <button
              type="button"
              className={styles.trash}
              onClick={onDelete}
              disabled={isBusy}
              aria-label={`Eliminar el pedido ${order.code}`}
              title="Eliminar este pedido"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
