import { useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { Order } from '@shared/domain/order';
import { paymentLinkFor } from '@shared/domain/whatsapp';
import styles from './PayWithMercadoPago.module.css';

type PayableOrder = Pick<Order, 'code' | 'total' | 'paymentLink'>;

/**
 * Pagar con Mercado Pago, sin credenciales de por medio.
 *
 * El link de cobro del club es de **monto abierto**: Mercado Pago le pide al
 * socio que escriba cuánto pagar, y no hay ningún parámetro de URL para
 * precargarlo —el importe se define al crear el link, no al compartirlo—.
 * Automatizarlo requiere crear una preferencia por pedido con el access token
 * del club.
 *
 * Mientras eso no exista, lo único que se puede hacer es que escribir el monto
 * no cueste nada: se copia al portapapeles en el mismo gesto que abre Mercado
 * Pago, así el socio sólo tiene que pegar.
 */
export function PayWithMercadoPago({ order }: { order: PayableOrder }) {
  const [copied, setCopied] = useState(false);
  const link = paymentLinkFor(order as Order);

  function handlePay() {
    // Se copian los dígitos pelados: "$ 92.950" no entra en el campo de
    // Mercado Pago, que espera un número.
    try {
      void navigator.clipboard?.writeText(String(order.total));
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles el monto igual está a la vista arriba.
    }

    // Sin `await` antes de abrir: si se espera a la promesa del portapapeles,
    // el navegador deja de ver la pestaña como parte del click y la bloquea.
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.amount}>
        <span className={styles.amountLabel}>Monto a pagar</span>
        <strong className={styles.amountValue}>{formatPrice(order.total)}</strong>
      </div>

      <button type="button" className={styles.pay} onClick={handlePay}>
        {copied ? '✓ Monto copiado · Ir a Mercado Pago' : 'Copiar monto y pagar'}
      </button>

      {/* Que sepa de antemano que le van a pedir el importe: la sorpresa es lo
          que hace que la gente abandone el pago. */}
      <p className={styles.note}>
        Mercado Pago te va a pedir el monto. Te lo copiamos: sólo tenés que pegarlo.
      </p>
    </div>
  );
}
