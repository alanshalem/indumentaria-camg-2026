import { formatPrice } from '@shared/domain/money';
import { isBackordered, variantLabel, type Order } from '@shared/domain/order';
import { ON_DEMAND_LEAD_TIME } from '@shared/domain/stock';
import { OrderEmailHistory } from './OrderEmailHistory';
import { ORDER_COLUMNS } from './columns';
import styles from './OrderTable.module.css';

interface Props {
  order: Order;
  /** La fila está esperando al servidor: no se puede marcar nada más. */
  isBusy: boolean;
  onDeliveredChange: (index: number, delivered: boolean) => void;
}

/**
 * El detalle desplegable de un pedido: las prendas con su control de entrega,
 * las promos aplicadas, los totales y el historial de avisos.
 *
 * Vive aparte de la fila porque es otra cosa: la fila es un resumen que se
 * escanea, esto es la ficha que se lee.
 */
export function OrderDetail({ order, isBusy, onDeliveredChange }: Props) {
  return (
    <tr className={styles.detailRow}>
      <td colSpan={ORDER_COLUMNS.length}>
        <ul className={styles.detailList}>
          {order.items.map((item, index) => (
            <li
              key={`${order.code}-${item.productId}-${item.size}-${index}`}
              className={item.delivered ? styles.itemDone : undefined}
            >
              <span className={styles.itemQty}>{item.quantity}×</span>

              <span className={styles.itemInfo}>
                <span className={styles.itemName}>{item.productName}</span>
                <span className={styles.itemMeta}>Talle {variantLabel(item)}</span>
                {isBackordered(item) && (
                  <span className={styles.itemBackorder}>
                    {item.backorderedUnits} a pedido · {ON_DEMAND_LEAD_TIME}
                  </span>
                )}
              </span>

              <span className={styles.itemPrice}>
                {formatPrice(item.unitPrice * item.quantity)}
              </span>

              {/* Control interno: marcar una prenda no le manda nada al socio.
                  El mail sale cuando el pedido entero pasa a "Entregado". */}
              <label
                className={`${styles.deliverBox} ${item.delivered ? styles.deliverOn : ''}`}
                title="Control interno: no le llega ningún mail al socio"
              >
                <input
                  type="checkbox"
                  checked={item.delivered}
                  disabled={isBusy}
                  onChange={(event) => onDeliveredChange(index, event.target.checked)}
                />
                <span>Entregado</span>
              </label>
            </li>
          ))}
        </ul>

        {order.promotions.length > 0 && (
          <ul className={styles.promoList}>
            {order.promotions.map((promotion, index) => (
              <li key={`${promotion.id}-${index}`}>
                <span className={styles.promoLabel}>{promotion.label}</span>
                <span className={styles.promoDetail}>{promotion.detail}</span>
                <span className={styles.promoAmount}>−{formatPrice(promotion.amount)}</span>
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

        {/* Se pide recién al desplegar: no tiene sentido traer el historial de
            cien pedidos que nadie va a abrir. */}
        <OrderEmailHistory code={order.code} />
      </td>
    </tr>
  );
}
