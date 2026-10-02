import { Fragment, useState } from 'react';
import { customerFullName, type Order, type OrderStatus } from '@shared/domain/order';
import type { PaymentMethod } from '@shared/domain/payment';
import { useAdminAction } from '@/hooks/useAdminAction';
import { orderService } from '@/services/orderService';
import { Alert, EmptyState, Modal } from '@/ui';
import { DeleteOrderDialog } from './DeleteOrderDialog';
import { OrderDetail } from './OrderDetail';
import { OrderRow } from './OrderRow';
import { WhatsappDialog } from './WhatsappDialog';
import { ORDER_COLUMNS } from './columns';
import { describeUpdate } from './statusNotice';
import styles from './OrderTable.module.css';

interface Props {
  orders: readonly Order[];
  onStatusChange: (order: Order) => void;
}

/**
 * El listado de pedidos del panel.
 *
 * Acá vive lo que es de la tabla: qué fila está abierta, qué diálogo está
 * arriba y las tres mutaciones. La fila, el detalle y la confirmación de
 * borrado son componentes propios: eran 441 líneas en las que no había ninguna
 * pieza que se pudiera mirar sola.
 *
 * El trío ocupado/aviso/error lo maneja `useAdminAction`, igual que los paneles
 * de productos y promociones. Antes esto tenía tres `try/catch` propios.
 */
export function OrderTable({ orders, onStatusChange }: Props) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  // Eliminar es destructivo y la fila es angosta: se confirma en un diálogo
  // que dice de qué pedido se trata.
  const [confirming, setConfirming] = useState<Order | null>(null);
  const [messaging, setMessaging] = useState<Order | null>(null);

  const { busyId, notice, error, run } = useAdminAction();

  /**
   * El servidor decide si corresponde mandar mail y evita duplicados; acá sólo
   * se muestra lo que informó que hizo, y por eso el mensaje sale de la
   * respuesta en vez de ser un texto fijo.
   */
  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    void run(
      order.code,
      async () => {
        const update = await orderService.updateStatus(order.code, status);
        onStatusChange(update.order);
        return update;
      },
      describeUpdate,
      'No se pudo actualizar el estado.',
    );
  };

  /**
   * Marca una prenda como entregada. A diferencia del estado, esto **no manda
   * ningún mail**: es control interno del club para los pedidos que se entregan
   * en partes. Sin aviso de éxito, justamente porque no anunció nada.
   */
  const changeDelivered = (order: Order, index: number, delivered: boolean) =>
    void run(
      order.code,
      async () => onStatusChange(await orderService.setItemDelivered(order.code, index, delivered)),
      null,
      'No se pudo marcar la prenda.',
    );

  const changePayment = (order: Order, method: PaymentMethod | null) =>
    void run(
      order.code,
      // El link se conserva: cambiar a efectivo y volver no lo borra.
      async () =>
        onStatusChange(
          await orderService.setPayment(order.code, { method, link: order.paymentLink }),
        ),
      null,
      'No se pudo guardar el método de pago.',
    );

  if (orders.length === 0) {
    return <EmptyState title="No hay pedidos que coincidan con los filtros." />;
  }

  return (
    <>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Modal
        size="lg"
        isOpen={messaging !== null}
        onClose={() => setMessaging(null)}
        title={messaging ? `Mensajes · ${customerFullName(messaging)}` : 'Mensajes'}
      >
        {messaging && (
          <WhatsappDialog
            order={messaging}
            onOrderChange={(updated) => {
              onStatusChange(updated);
              setMessaging(updated);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Eliminar pedido"
      >
        {confirming && (
          <DeleteOrderDialog
            order={confirming}
            onCancel={() => setConfirming(null)}
            onConfirm={() => {
              const target = confirming;
              setConfirming(null);
              changeStatus(target, 'cancelled');
            }}
          />
        )}
      </Modal>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {ORDER_COLUMNS.map((column, index) => (
                <th
                  key={column.label || `acciones-${index}`}
                  className={column.align === 'right' ? styles.right : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isOpen = expandedCode === order.code;
              const isBusy = busyId === order.code;

              return (
                <Fragment key={order.code}>
                  <OrderRow
                    order={order}
                    isOpen={isOpen}
                    isBusy={isBusy}
                    onToggleDetail={() => setExpandedCode(isOpen ? null : order.code)}
                    onStatusChange={(status) => changeStatus(order, status)}
                    onPaymentChange={(method) => changePayment(order, method)}
                    onMessages={() => setMessaging(order)}
                    onDelete={() => setConfirming(order)}
                  />
                  {isOpen && (
                    <OrderDetail
                      order={order}
                      isBusy={isBusy}
                      onDeliveredChange={(index, delivered) =>
                        changeDelivered(order, index, delivered)
                      }
                    />
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
