import { describe, expect, it } from 'vitest';
import { createOrderSchema, orderCodeSchema } from '../shared/schemas/order.schema';
import { productInputSchema } from '../shared/schemas/product.schema';
import { promotionPatchSchema, comboConfigSchema } from '../shared/schemas/promotion.schema';
import { formatPhone, normalizePhone, whatsappLink } from '../shared/domain/phone';

describe('createOrderSchema', () => {
  const valid = {
    customerName: 'Ana',
    customerLastName: 'Pérez',
    phone: '11 2345-6789',
    email: 'ana@ejemplo.com',
    paymentMethod: 'mercadopago',
    items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
  };

  it('acepta un pedido válido', () => {
    expect(createOrderSchema.safeParse(valid).success).toBe(true);
  });

  it('exige elegir forma de pago: el club no puede adivinarla', () => {
    const { paymentMethod: _sin, ...faltante } = valid;
    expect(createOrderSchema.safeParse(faltante).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, paymentMethod: 'bitcoin' }).success).toBe(false);
  });

  it('acepta las dos formas que maneja el club', () => {
    for (const method of ['cash', 'mercadopago']) {
      expect(createOrderSchema.safeParse({ ...valid, paymentMethod: method }).success).toBe(true);
    }
  });

  it('recorta espacios y normaliza el teléfono a dígitos', () => {
    const parsed = createOrderSchema.parse({ ...valid, customerName: '  Ana  ' });
    expect(parsed.customerName).toBe('Ana');
    expect(parsed.phone).toBe('1123456789');
  });

  it('exige un teléfono de contacto', () => {
    expect(createOrderSchema.safeParse({ ...valid, phone: '' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, phone: '123' }).success).toBe(false);
  });

  it('exige el email: es el canal por el que se avisa el estado del pedido', () => {
    const { email: _sinMail, ...faltaEmail } = valid;
    expect(createOrderSchema.safeParse(faltaEmail).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, email: '' }).success).toBe(false);
  });

  it('normaliza el email antes de validarlo', () => {
    // Pegar un mail con un espacio al final es lo mas comun del mundo.
    expect(createOrderSchema.parse({ ...valid, email: '  Socio@Club.COM ' }).email).toBe(
      'socio@club.com',
    );
  });

  it('rechaza un email inválido', () => {
    expect(createOrderSchema.safeParse({ ...valid, email: 'no-es-mail' }).success).toBe(false);
  });

  it('rechaza el carrito vacío', () => {
    expect(createOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('rechaza cantidades no enteras o fuera de rango', () => {
    for (const quantity of [0, -1, 1.5, 999]) {
      const result = createOrderSchema.safeParse({ ...valid, items: [{ productId: 'x', size: 'M', quantity }] });
      expect(result.success).toBe(false);
    }
  });

  it('ignora campos de precio inyectados por el cliente', () => {
    const parsed = createOrderSchema.parse({
      ...valid,
      items: [{ productId: 'campera-canguro', size: 'M', quantity: 1, unitPrice: 1 }],
      total: 1,
    });
    expect(parsed.items[0]).not.toHaveProperty('unitPrice');
    expect(parsed).not.toHaveProperty('total');
  });
});

describe('teléfono', () => {
  it('deja sólo dígitos', () => {
    expect(normalizePhone('(011) 4567-8901')).toBe('01145678901');
  });

  it('formatea completo, listo para copiar', () => {
    expect(formatPhone('1123456789')).toBe('+54 9 11 2345-6789');
  });

  it('arma el link de WhatsApp con el 9 de celular', () => {
    // El 9 no es decorativo: sin el, wa.me no resuelve un celular argentino.
    // El link viejo salia como 54 11 4567 8901 y no abria el chat.
    expect(whatsappLink('011 4567-8901')).toBe('https://wa.me/5491145678901');
    expect(whatsappLink('5491145678901')).toBe('https://wa.me/5491145678901');
  });
});

describe('orderCodeSchema', () => {
  it('normaliza a mayúsculas', () => {
    expect(orderCodeSchema.parse('camg-2026-abcde')).toBe('CAMG-2026-ABCDE');
  });

  it('rechaza basura', () => {
    expect(orderCodeSchema.safeParse("'; drop table orders; --").success).toBe(false);
  });
});

describe('productInputSchema', () => {
  const valid = {
    name: 'Campera Canguro CAMG',
    imageUrl: '/images/fotos-prendas/campera.jpg',
    sizesSmall: ['6', '8'],
    sizesLarge: ['S', 'M'],
    priceSmall: 48500,
    priceLarge: 54000,
  };

  it('aplica los valores por defecto', () => {
    const parsed = productInputSchema.parse(valid);
    expect(parsed).toMatchObject({
      description: '',
      isActive: true,
      sortOrder: 0,
      colors: [],
      sizeChartId: null,
    });
  });

  it('exige al menos un talle entre los dos tiers', () => {
    expect(
      productInputSchema.safeParse({ ...valid, sizesSmall: [], sizesLarge: [] }).success,
    ).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, sizesSmall: [] }).success).toBe(true);
  });

  it('no deja el mismo talle en los dos tiers', () => {
    expect(
      productInputSchema.safeParse({ ...valid, sizesSmall: ['M'], sizesLarge: ['M'] }).success,
    ).toBe(false);
  });

  it('rechaza precios con decimales o negativos', () => {
    expect(productInputSchema.safeParse({ ...valid, priceLarge: 999.99 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, priceSmall: -1 }).success).toBe(false);
  });

  it('rechaza un id que no es slug', () => {
    expect(productInputSchema.safeParse({ ...valid, id: 'Campera CAMG' }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, id: 'campera-camg' }).success).toBe(true);
  });

  it('valida los colores', () => {
    const withColors = (colors: unknown) => productInputSchema.safeParse({ ...valid, colors });

    expect(withColors([{ name: 'Roja', hex: '#DC143C', imageUrl: null }]).success).toBe(true);
    expect(withColors([{ name: 'Roja', hex: 'rojo', imageUrl: null }]).success).toBe(false);
    expect(withColors([{ name: '', hex: '#DC143C', imageUrl: null }]).success).toBe(false);
    expect(
      withColors([
        { name: 'Roja', hex: '#DC143C', imageUrl: null },
        { name: 'Roja', hex: '#000000', imageUrl: null },
      ]).success,
    ).toBe(false);
  });

  it('sólo acepta tablas de talles conocidas', () => {
    expect(productInputSchema.safeParse({ ...valid, sizeChartId: 'remeras' }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...valid, sizeChartId: 'inventada' }).success).toBe(false);
  });
});

describe('promotion schemas', () => {
  it('valida la configuración de un combo', () => {
    const config = {
      productIds: ['buzo-medio-cierre', 'pantalon-con-cierre'],
      bundlePriceLarge: 85000,
      bundlePriceSmall: 75000,
    };
    expect(comboConfigSchema.safeParse(config).success).toBe(true);
    expect(comboConfigSchema.safeParse({ ...config, productIds: ['uno'] }).success).toBe(false);
    expect(comboConfigSchema.safeParse({ ...config, bundlePriceLarge: -1 }).success).toBe(false);
  });

  it('exige al menos un cambio en el patch', () => {
    expect(promotionPatchSchema.safeParse({}).success).toBe(false);
    expect(promotionPatchSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});
