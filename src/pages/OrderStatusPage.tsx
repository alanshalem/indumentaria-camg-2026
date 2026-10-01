import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  countOrderUnits,
  customerFullName,
  isOpenOrder,
  type PublicOrder,
} from '@shared/domain/order';
import { formatPrice } from '@shared/domain/money';
import { CLUB } from '@shared/domain/club';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { orderService } from '@/services/orderService';
import { formatDateTime } from '@/utils/formatDate';
import { CartSummary } from '@/components/cart/CartSummary';
import { OrderTimeline } from '@/components/checkout/OrderTimeline';
import { PayWithMercadoPago } from '@/components/checkout/PayWithMercadoPago';
import { Spinner } from '@/ui';
import styles from './OrderStatusPage.module.css';

const NO_ORDER: PublicOrder | null = null;

/**
 * Seguimiento del pedido, sin login.
 *
 * El socio no tiene cuenta: la autorización es el token firmado que viaja en el
 * link del mail. Sólo quien recibió ese mail puede abrir esta página, y sólo
 * para ese pedido.
 */
export function OrderStatusPage() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';

  const load = useCallback(
    () => (code ? orderService.getPublic(code, token) : Promise.resolve(NO_ORDER)),
    [code, token],
  );
  const { data: order, error, isLoading } = useAsyncResource(load, NO_ORDER, [load]);

  useDocumentTitle(order ? `Pedido ${order.code}` : 'Seguimiento de pedido');

  if (isLoading) {
    return (
      <div className="centered-viewport">
        <Spinner size={28} label="Buscando tu pedido…" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.notFound}>
        <h1>No encontramos ese pedido</h1>
        <p>
          El link puede estar incompleto o vencido. Abrí de nuevo el mail que te mandamos, o
          escribinos {CLUB.contactPhone ? `al ${CLUB.contactPhone}` : `por Instagram (${CLUB.instagram})`}{' '}
          con tu código de pedido.
        </p>
        <Link to="/" className="btn btn-ghost">
          Ir al catálogo
        </Link>
      </div>
    );
  }

  const units = countOrderUnits(order.items);
  const hasPickupInfo =
    Boolean(CLUB.pickupAddress) || CLUB.pickupHours.length > 0 || Boolean(CLUB.contactPhone);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.eyebrow}>Seguimiento de pedido</span>
          <h1 className={styles.code}>{order.code}</h1>
          <p className={styles.meta}>
            {customerFullName(order)} · {formatDateTime(order.timestamp)} · {units}{' '}
            {units === 1 ? 'prenda' : 'prendas'}
          </p>
        </header>

        <section className={styles.card} aria-label="Estado del pedido">
          <OrderTimeline status={order.status} />
        </section>

        <section className={styles.card} aria-label="Detalle del pedido">
          <h2 className={styles.sectionTitle}>Tu pedido</h2>
          <ul className={styles.items}>
            {order.items.map((item, index) => (
              <li key={`${item.productId}-${item.size}-${index}`}>
                <span className={styles.itemQty}>{item.quantity}×</span>
                <span className={styles.itemName}>
                  {item.productName}
                  <em>
                    Talle {item.size}
                    {item.color && ` · ${item.color}`}
                  </em>
                </span>
                <span className={styles.itemPrice}>
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.summary}>
            <CartSummary
              outcome={{
                subtotal: order.subtotal,
                discounts: order.promotions,
                discountTotal: order.subtotal - order.total,
                total: order.total,
              }}
              compact
            />
          </div>
        </section>

        {/* El socio que vuelve desde el mail tiene que poder pagar acá mismo,
            sin buscar el mensaje otra vez. */}
        {order.paymentMethod === 'mercadopago' && isOpenOrder(order.status) && (
          <section className={styles.card} aria-label="Pago">
            <h2 className={styles.sectionTitle}>Pagar</h2>
            <PayWithMercadoPago order={order} />
          </section>
        )}

        {hasPickupInfo && (
          <section className={styles.card} aria-label="Datos del club">
            <h2 className={styles.sectionTitle}>Retiro</h2>
            <dl className={styles.info}>
              {CLUB.pickupAddress && (
                <div>
                  <dt>Dirección</dt>
                  <dd>{CLUB.pickupAddress}</dd>
                </div>
              )}
              {CLUB.pickupHours.length > 0 && (
                <div>
                  <dt>Horarios</dt>
                  {/* Un renglón por ventana horaria: son varias y en una sola
                      línea con separadores no se leen. */}
                  <dd className={styles.hours}>
                    {CLUB.pickupHours.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </dd>
                </div>
              )}
              {CLUB.contactPhone && (
                <div>
                  <dt>Consultas</dt>
                  <dd>{CLUB.contactPhone}</dd>
                </div>
              )}
            </dl>
            <p className={styles.note}>Mostrá el código {order.code} al retirar.</p>
          </section>
        )}

        <Link to="/#catalogo" className={styles.back}>
          ← Seguir viendo el catálogo
        </Link>
      </div>
    </div>
  );
}
