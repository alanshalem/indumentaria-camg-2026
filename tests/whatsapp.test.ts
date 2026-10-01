import { describe, expect, it } from 'vitest';
import { CLUB } from '../shared/domain/club';
import { formatPrice } from '../shared/domain/money';
import type { Order } from '../shared/domain/order';
import {
  MISSING_PAYMENT_LINK,
  needsPaymentLink,
  paymentLinkFor,
  whatsappMessage,
  whatsappMessageLink,
  WHATSAPP_TEMPLATES,
} from '../shared/domain/whatsapp';

const order = (overrides: Partial<Order> = {}): Order => ({
  code: 'CAMG-2026-BRM73',
  timestamp: Date.UTC(2026, 8, 7, 11, 36),
  customerName: 'Natalia',
  customerLastName: 'Bacchetto',
  phone: '1153891955',
  email: 'natalia@ejemplo.com',
  items: [
    {
      productId: 'remera-algodon', productName: 'Remera de algodón', size: '12',
      sizeTier: 'small', color: 'Roja', quantity: 2, unitPrice: 20500,
      backorderedUnits: 0, delivered: false,
    },
  ],
  subtotal: 41000,
  promotions: [],
  total: 28000,
  status: 'pending',
  paymentMethod: null,
  paymentLink: null,
  ...overrides,
});

describe('plantillas de WhatsApp', () => {
  it('el link de pago trae nombre, codigo, detalle, total y link', () => {
    const texto = whatsappMessage('paymentLink', order({ paymentLink: 'https://mpago.la/abc' }));

    expect(texto).toContain('Natalia Bacchetto');
    expect(texto).toContain('CAMG-2026-BRM73');
    expect(texto).toContain('Remera de algodón');
    // `formatPrice` usa espacio duro: compararlo contra la funcion y no
    // contra un literal evita un test que falla por un caracter invisible.
    expect(texto).toContain(formatPrice(28000));
    expect(texto).toContain('https://mpago.la/abc');
    expect(texto).toContain('comprobante');
  });

  it('sin link propio cae en el generico del club', () => {
    const texto = whatsappMessage('paymentLink', order());

    expect(texto).toContain(CLUB.paymentLink);
    expect(needsPaymentLink('paymentLink', order())).toBe(false);
  });

  it('el link del pedido le gana al del club', () => {
    // El del pedido trae el monto ya cargado; el del club es generico.
    const propio = order({ paymentLink: 'https://mpago.la/con-monto' });

    expect(paymentLinkFor(propio)).toBe('https://mpago.la/con-monto');
    expect(whatsappMessage('paymentLink', propio)).not.toContain(CLUB.paymentLink);
  });

  it('sin ningun link deja un marcador visible, no un hueco', () => {
    // Que el club lo vea antes de mandar es mejor que un mensaje que dice
    // "el link de pago es:" y termina ahi.
    const sinNada = { ...CLUB, paymentLink: '' };
    const texto = whatsappMessage('paymentLink', order(), sinNada);

    expect(texto).toContain(MISSING_PAYMENT_LINK);
  });

  it('el de efectivo manda a la sede y no pide link', () => {
    const texto = whatsappMessage('cash', order());

    expect(texto).toContain('efectivo');
    expect(texto).toContain('Hipólito Yrigoyen 77');
    expect(texto).not.toContain(MISSING_PAYMENT_LINK);
    expect(needsPaymentLink('cash', order())).toBe(false);
  });

  it('el detalle va en renglones y no en una sola linea', () => {
    const dos = order({
      items: [
        { ...order().items[0]!, productName: 'Remera' },
        { ...order().items[0]!, productName: 'Campera', size: 'XL', color: null },
      ],
    });

    const lineas = whatsappMessage('cash', dos).split('\n').filter((l) => l.startsWith('•'));
    expect(lineas).toHaveLength(2);
  });

  it('el link abre wa.me con el 9 de celular y el texto adentro', () => {
    const url = new URL(whatsappMessageLink('cash', order()));

    expect(url.host).toBe('wa.me');
    expect(url.pathname).toBe('/5491153891955');
    expect(url.searchParams.get('text')).toContain('CAMG-2026-BRM73');
  });

  it('todas las plantillas producen texto', () => {
    for (const template of WHATSAPP_TEMPLATES) {
      expect(whatsappMessage(template, order()).length).toBeGreaterThan(60);
    }
  });
});
