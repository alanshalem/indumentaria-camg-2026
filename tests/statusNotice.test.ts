import { describe, expect, it } from 'vitest';
import type { Order } from '../shared/domain/order';
import type { OrderStatusUpdate } from '../shared/api/contracts';
import { describeUpdate } from '../src/components/admin/orders/statusNotice';

const order = (status: Order['status']): Order => ({
  code: 'CAMG-2026-RNRP9',
  timestamp: 0,
  customerName: 'Alan',
  customerLastName: 'Shalem',
  phone: '1123456789',
  email: 'alan@ejemplo.com',
  items: [],
  subtotal: 0,
  promotions: [],
  total: 0,
  status,
});

const update = (partial: Partial<OrderStatusUpdate> & Pick<OrderStatusUpdate, 'order'>) => ({
  notice: null,
  missed: [],
  ...partial,
});

describe('describeUpdate', () => {
  it('dice a quien se le mando el aviso', () => {
    const { tone, text } = describeUpdate(
      update({
        order: order('paid'),
        notice: { kind: 'paymentConfirmed', status: 'sent', recipient: 'alan@ejemplo.com' },
      }),
    );

    expect(tone).toBe('success');
    expect(text).toContain('Confirmamos tu pago');
    expect(text).toContain('alan@ejemplo.com');
  });

  it('distingue un estado sin aviso de un envio fallido', () => {
    const sinAviso = describeUpdate(update({ order: order('delivered') }));
    const fallido = describeUpdate(
      update({
        order: order('ready'),
        notice: {
          kind: 'readyForPickup',
          status: 'failed',
          recipient: 'alan@ejemplo.com',
          reason: 'Resend respondio 500.',
        },
      }),
    );

    expect(sinAviso.tone).toBe('success');
    expect(sinAviso.text).toContain('no manda ningún aviso');
    expect(fallido.tone).toBe('error');
    expect(fallido.text).toContain('Resend respondio 500.');
  });

  it('avisa que no se repite un mail ya enviado', () => {
    const { text } = describeUpdate(
      update({
        order: order('paid'),
        notice: { kind: 'paymentConfirmed', status: 'already', recipient: 'alan@ejemplo.com' },
      }),
    );

    expect(text).toContain('no se repite');
  });

  it('canta los avisos que quedaron sin mandar al saltear etapas', () => {
    // El caso exacto del club: "Pendiente" -> "Entregado" de un saque.
    const { text } = describeUpdate(
      update({ order: order('delivered'), missed: ['paymentConfirmed', 'readyForPickup'] }),
    );

    expect(text).toContain('nunca se le mandó');
    expect(text).toContain('Confirmamos tu pago');
    expect(text).toContain('Listo para retirar');
  });

  it('no menciona etapas futuras: eso no es un problema', () => {
    const { text } = describeUpdate(
      update({
        order: order('paid'),
        notice: { kind: 'paymentConfirmed', status: 'sent', recipient: 'alan@ejemplo.com' },
      }),
    );

    expect(text).not.toContain('nunca se le mandó');
  });
});
