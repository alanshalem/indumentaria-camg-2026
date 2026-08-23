import { describe, expect, it } from 'vitest';
import {
  computeSubtotal,
  countOrderUnits,
  describeItem,
  isOpenOrder,
  ORDER_STATUSES,
} from '../shared/domain/order';
import { generateOrderCode, isOrderCode } from '../shared/domain/orderCode';
import { formatPrice, isValidPrice } from '../shared/domain/money';
import { priceBands, resolveProductId, sizeRangeLabel, slugify } from '../shared/domain/product';

describe('orderCode', () => {
  it('genera un código con el formato esperado', () => {
    expect(isOrderCode(generateOrderCode(2026))).toBe(true);
  });

  it('es determinista cuando se le inyecta el generador aleatorio', () => {
    const stub = (count: number) => Array.from({ length: count }, (_, index) => index);
    expect(generateOrderCode(2026, stub)).toBe('CAMG-2026-ABCDE');
  });

  it('excluye caracteres ambiguos para poder dictarlo por teléfono', () => {
    const codes = Array.from({ length: 200 }, () => generateOrderCode(2026));
    expect(codes.every((code) => !/[01IO]/.test(code.slice(10)))).toBe(true);
  });

  it('rechaza códigos con formato inválido', () => {
    expect(isOrderCode('CAMG-26-ABCDE')).toBe(false);
    expect(isOrderCode('camg-2026-abcde')).toBe(false);
    expect(isOrderCode('CAMG-2026-ABCD0')).toBe(false);
  });
});

describe('order', () => {
  const items = [
    {
      productId: 'a', productName: 'Campera', size: 'M', sizeTier: 'large' as const,
      color: null, quantity: 2, unitPrice: 54000,
    },
    {
      productId: 'b', productName: 'Medias', size: '42-50', sizeTier: 'large' as const,
      color: 'Negras', quantity: 3, unitPrice: 6500,
    },
  ];

  it('suma el subtotal por línea', () => {
    expect(computeSubtotal(items)).toBe(127500);
  });

  it('describe una línea con talle y color', () => {
    expect(describeItem(items[1]!)).toBe('3× Medias (42-50 · Negras)');
    expect(describeItem(items[0]!)).toBe('2× Campera (M)');
  });

  it('cuenta unidades, no líneas', () => {
    expect(countOrderUnits(items)).toBe(5);
  });

  it('sólo "entregado" cierra el pedido', () => {
    expect(ORDER_STATUSES.filter(isOpenOrder)).toEqual(['pending', 'paid', 'ready']);
    expect(isOpenOrder('delivered')).toBe(false);
  });
});

describe('money', () => {
  it('formatea en pesos sin centavos', () => {
    expect(formatPrice(50000).replace(/ /g, ' ')).toContain('50.000');
  });

  it('no formatea valores nulos', () => {
    expect(formatPrice(null)).toBe('');
  });

  it('rechaza precios no enteros o negativos', () => {
    expect(isValidPrice(1000)).toBe(true);
    expect(isValidPrice(10.5)).toBe(false);
    expect(isValidPrice(-1)).toBe(false);
  });
});

describe('slugify', () => {
  it('normaliza acentos, símbolos y espacios', () => {
    expect(slugify('Campera 1/2 cierre — Algodón')).toBe('campera-1-2-cierre-algodon');
  });

  it('es idempotente', () => {
    const once = slugify('Musculosa de Entrenamiento');
    expect(slugify(once)).toBe(once);
  });

  it('deriva el id del nombre cuando no se especifica', () => {
    expect(resolveProductId({ name: 'Buzo Canguro' })).toBe('buzo-canguro');
    expect(resolveProductId({ id: 'buzo-custom', name: 'Buzo Canguro' })).toBe('buzo-custom');
  });
});

describe('tramos de precio por talle', () => {
  const campera = {
    sizesSmall: ['6', '8', '10', '12', '14'],
    sizesLarge: ['16/XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    priceSmall: 48500,
    priceLarge: 54000,
  };

  it('resume un tramo por sus extremos', () => {
    expect(sizeRangeLabel(campera.sizesSmall)).toBe('6 a 14');
    expect(sizeRangeLabel(['Único'])).toBe('Único');
    expect(sizeRangeLabel([])).toBe('');
  });

  it('devuelve los dos tramos con su precio', () => {
    expect(priceBands(campera)).toEqual([
      { tier: 'small', range: '6 a 14', price: 48500 },
      { tier: 'large', range: '16/XS a 3XL', price: 54000 },
    ]);
  });

  it('no muestra tramos cuando los dos precios son iguales', () => {
    // Toallas y cuellos valen lo mismo en cualquier talle: dos columnas serían ruido.
    expect(priceBands({ ...campera, priceSmall: 2000, priceLarge: 2000 })).toEqual([]);
  });

  it('no muestra tramos cuando uno de los dos no tiene talles', () => {
    expect(priceBands({ ...campera, sizesSmall: [] })).toEqual([]);
  });
});
