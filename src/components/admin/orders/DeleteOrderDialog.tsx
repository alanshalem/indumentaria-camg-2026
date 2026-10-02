import { formatPrice } from '@shared/domain/money';
import { customerFullName, type Order } from '@shared/domain/order';
import { Button } from '@/ui';
import styles from './OrderTable.module.css';

interface Props {
  order: Order;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmación de borrado.
 *
 * Eliminar es destructivo y la fila es angosta, así que el diálogo dice de qué
 * pedido se trata y qué implica: que no se borra de la base, que se puede
 * restaurar y que al socio no le llega nada.
 */
export function DeleteOrderDialog({ order, onCancel, onConfirm }: Props) {
  return (
    <div className={styles.confirm}>
      <p>
        El pedido <strong>{order.code}</strong> de <strong>{customerFullName(order)}</strong> por{' '}
        <strong>{formatPrice(order.total)}</strong> deja de contar en los totales y sale del
        listado.
      </p>
      <p className={styles.confirmNote}>
        No se borra de la base: queda como «Eliminado» y lo podés restaurar filtrando por ese
        estado. Al socio no le llega ningún mail.
      </p>
      <div className={styles.confirmActions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onConfirm}>Eliminar pedido</Button>
      </div>
    </div>
  );
}
