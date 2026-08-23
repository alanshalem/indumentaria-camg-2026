import { describe, expect, it } from 'vitest';
import {
  comboPartnerOf,
  evaluatePromotions,
  nearbyPromotions,
  expandUnits,
  promotionNamesProduct,
  promotionsForProduct,
  type PricedUnit,
  type PromotionDefinition,
} from '../shared/domain/promotions';
import type { SizeTier } from '../shared/domain/product';

// Precios reales del manual (Agosto 2026), para que los tests fallen si alguien
// toca la lista sin actualizar las promos.
const PRICES = {
  buzoMedioCierre: { large: 45500, small: 41000 },
  pantalon: { large: 48500, small: 44000 },
  remera: { large: 23000, small: 20500 },
} as const;

const COMBO: PromotionDefinition = {
  id: 'combo-buzo-pantalon',
  kind: 'combo',
  label: 'Combo buzo ½ cierre + pantalón',
  description: '',
  config: {
    productIds: ['buzo-medio-cierre', 'pantalon-con-cierre'],
    bundlePriceLarge: 85000,
    bundlePriceSmall: 75000,
  },
  isActive: true,
  sortOrder: 10,
};

const FAMILIA: PromotionDefinition = {
  id: 'familia-camg',
  kind: 'sameProductDifferentSize',
  label: 'Promo familia CAMG',
  description: '',
  config: { percentOff: 10 },
  isActive: true,
  sortOrder: 20,
};

let counter = 0;
const unit = (productId: string, size: string, tier: SizeTier, unitPrice: number): PricedUnit => ({
  lineKey: `line-${(counter += 1)}`,
  productId,
  productName: productId,
  size,
  tier,
  unitPrice,
});

const buzo = (size: string, tier: SizeTier) =>
  unit('buzo-medio-cierre', size, tier, PRICES.buzoMedioCierre[tier]);
const pantalon = (size: string, tier: SizeTier) =>
  unit('pantalon-con-cierre', size, tier, PRICES.pantalon[tier]);
const remera = (size: string, tier: SizeTier) => unit('remera-algodon', size, tier, PRICES.remera[tier]);

describe('combo buzo ½ cierre + pantalón', () => {
  it('cobra el precio de combo cuando los dos son talles grandes', () => {
    const result = evaluatePromotions([buzo('L', 'large'), pantalon('L', 'large')], [COMBO]);

    expect(result.subtotal).toBe(94000);
    expect(result.total).toBe(85000);
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0]?.amount).toBe(9000);
  });

  it('cobra el precio chico sólo si las dos prendas son de talle chico', () => {
    const result = evaluatePromotions([buzo('12', 'small'), pantalon('10', 'small')], [COMBO]);

    expect(result.subtotal).toBe(85000);
    expect(result.total).toBe(75000);
  });

  it('un par mixto paga el precio grande', () => {
    const result = evaluatePromotions([buzo('L', 'large'), pantalon('12', 'small')], [COMBO]);

    expect(result.subtotal).toBe(89500);
    expect(result.total).toBe(85000);
  });

  it('arma primero los pares del mismo tier para maximizar el ahorro', () => {
    // Con 1 buzo grande, 1 buzo chico, 1 pantalón grande y 1 pantalón chico hay
    // dos armados posibles: 2 pares mixtos (4.500 + 4.500) o grande+grande y
    // chico+chico (9.000 + 10.000). Tiene que elegir el segundo.
    const result = evaluatePromotions(
      [buzo('L', 'large'), buzo('12', 'small'), pantalon('L', 'large'), pantalon('12', 'small')],
      [COMBO],
    );

    expect(result.discountTotal).toBe(19000);
  });

  it('deja fuera del combo las unidades que sobran', () => {
    const result = evaluatePromotions(
      [buzo('L', 'large'), buzo('M', 'large'), pantalon('L', 'large')],
      [COMBO],
    );

    expect(result.discounts).toHaveLength(1);
    expect(result.subtotal).toBe(45500 * 2 + 48500);
    expect(result.total).toBe(result.subtotal - 9000);
  });

  it('no aplica si falta uno de los dos productos', () => {
    const result = evaluatePromotions([buzo('L', 'large'), buzo('M', 'large')], [COMBO]);
    expect(result.discounts).toHaveLength(0);
    expect(result.total).toBe(result.subtotal);
  });
});

describe('promo familia CAMG', () => {
  it('descuenta 10% sobre la unidad más barata del par', () => {
    const result = evaluatePromotions([remera('M', 'large'), remera('12', 'small')], [FAMILIA]);

    expect(result.subtotal).toBe(43500);
    expect(result.discounts[0]?.amount).toBe(2050); // 10% de 20500
    expect(result.total).toBe(41450);
  });

  it('no aplica con dos unidades del mismo talle', () => {
    const result = evaluatePromotions([remera('M', 'large'), remera('M', 'large')], [FAMILIA]);
    expect(result.discounts).toHaveLength(0);
  });

  it('con 3 iguales y 1 distinto forma un solo par válido', () => {
    // M, M, M, L → el único par con talles distintos es M+L. Los otros dos M
    // no pueden emparejarse entre sí.
    const result = evaluatePromotions(
      [remera('M', 'large'), remera('M', 'large'), remera('M', 'large'), remera('12', 'small')],
      [FAMILIA],
    );

    expect(result.discounts).toHaveLength(1);
  });

  it('forma dos pares cuando hay dos talles distintos por duplicado', () => {
    const result = evaluatePromotions(
      [remera('M', 'large'), remera('M', 'large'), remera('12', 'small'), remera('12', 'small')],
      [FAMILIA],
    );

    expect(result.discounts).toHaveLength(2);
    expect(result.discountTotal).toBe(2050 * 2);
  });

  it('no cruza productos distintos', () => {
    const result = evaluatePromotions([remera('M', 'large'), buzo('L', 'large')], [FAMILIA]);
    expect(result.discounts).toHaveLength(0);
  });
});

describe('interacción entre promociones', () => {
  it('una unidad no puede entrar en dos promos a la vez', () => {
    // Buzo L + pantalón L se van al combo; los dos buzos restantes (L y 12)
    // forman el par de la promo familia.
    const result = evaluatePromotions(
      [buzo('L', 'large'), buzo('L', 'large'), buzo('12', 'small'), pantalon('L', 'large')],
      [COMBO, FAMILIA],
    );

    expect(result.discounts).toHaveLength(2);
    expect(result.discounts[0]?.kind).toBe('combo');
    expect(result.discounts[1]?.kind).toBe('sameProductDifferentSize');
    expect(result.discountTotal).toBe(9000 + 4100); // 10% de 41000
  });

  it('respeta el orden de aplicación declarado en sortOrder', () => {
    const inverted = evaluatePromotions(
      [buzo('L', 'large'), buzo('12', 'small'), pantalon('L', 'large')],
      [
        { ...FAMILIA, sortOrder: 1 },
        { ...COMBO, sortOrder: 2 },
      ],
    );

    // Con la familia primero, los dos buzos se consumen y el combo se queda sin par.
    expect(inverted.discounts).toHaveLength(1);
    expect(inverted.discounts[0]?.kind).toBe('sameProductDifferentSize');
  });

  it('ignora las promociones apagadas', () => {
    const result = evaluatePromotions(
      [buzo('L', 'large'), pantalon('L', 'large')],
      [{ ...COMBO, isActive: false }],
    );
    expect(result.total).toBe(result.subtotal);
  });

  it('ignora una promo con configuración inválida en vez de romper el pedido', () => {
    const result = evaluatePromotions(
      [buzo('L', 'large'), pantalon('L', 'large')],
      [{ ...COMBO, config: { productIds: ['solo-uno'] } }],
    );
    expect(result.discounts).toHaveLength(0);
    expect(result.total).toBe(94000);
  });

  it('nunca deja el total en negativo', () => {
    const result = evaluatePromotions(
      [buzo('L', 'large'), pantalon('L', 'large')],
      [{ ...COMBO, config: { ...(COMBO.config as object), bundlePriceLarge: 0 } }],
    );
    expect(result.total).toBe(0);
  });

  it('sin promociones el total es el subtotal', () => {
    const result = evaluatePromotions([remera('M', 'large')], []);
    expect(result).toMatchObject({ subtotal: 23000, total: 23000, discountTotal: 0 });
  });
});

describe('expandUnits', () => {
  it('convierte cantidades en unidades sueltas', () => {
    const units = expandUnits([{ quantity: 3 }], () => remera('M', 'large'));
    expect(units).toHaveLength(3);
  });

  it('una línea con cantidad 2 y otra distinta alcanzan para la promo familia', () => {
    const lines = [
      { quantity: 1, size: 'M' as const },
      { quantity: 1, size: '12' as const },
    ];
    const units = expandUnits(lines, (line) =>
      remera(line.size, line.size === 'M' ? 'large' : 'small'),
    );

    expect(evaluatePromotions(units, [FAMILIA]).discounts).toHaveLength(1);
  });
});

describe('promociones por producto', () => {
  it('reconoce a los dos productos nombrados por el combo', () => {
    expect(promotionNamesProduct(COMBO, 'buzo-medio-cierre')).toBe(true);
    expect(promotionNamesProduct(COMBO, 'pantalon-con-cierre')).toBe(true);
    expect(promotionNamesProduct(COMBO, 'remera-algodon')).toBe(false);
  });

  it('la promo familia no nombra ningún producto puntual', () => {
    expect(promotionNamesProduct(FAMILIA, 'remera-algodon')).toBe(false);
  });

  it('lista el combo sólo en los productos que lo integran', () => {
    const delBuzo = promotionsForProduct('buzo-medio-cierre', [COMBO, FAMILIA]).map((p) => p.id);
    const deLaRemera = promotionsForProduct('remera-algodon', [COMBO, FAMILIA]).map((p) => p.id);

    expect(delBuzo).toEqual(['combo-buzo-pantalon', 'familia-camg']);
    // La promo familia aplica a todo el catálogo; el combo no.
    expect(deLaRemera).toEqual(['familia-camg']);
  });

  it('ignora las promos apagadas', () => {
    const result = promotionsForProduct('buzo-medio-cierre', [
      { ...COMBO, isActive: false },
      FAMILIA,
    ]);
    expect(result.map((p) => p.id)).toEqual(['familia-camg']);
  });

  it('devuelve el compañero del combo para poder linkearlo', () => {
    expect(comboPartnerOf(COMBO, 'buzo-medio-cierre')).toBe('pantalon-con-cierre');
    expect(comboPartnerOf(COMBO, 'pantalon-con-cierre')).toBe('buzo-medio-cierre');
    expect(comboPartnerOf(FAMILIA, 'remera-algodon')).toBeNull();
  });
});

describe('promos a un producto de distancia', () => {
  // Precios del catalogo, como los busca el carrito.
  const priceOf = (productId: string, tier: SizeTier) => {
    if (productId === 'buzo-medio-cierre') return PRICES.buzoMedioCierre[tier];
    if (productId === 'pantalon-con-cierre') return PRICES.pantalon[tier];
    if (productId === 'remera-algodon') return PRICES.remera[tier];
    return null;
  };

  it('avisa que falta el pantalon y cuanto se ahorra', () => {
    const nearby = nearbyPromotions([buzo('M', 'large')], [COMBO], priceOf);

    expect(nearby).toHaveLength(1);
    expect(nearby[0]).toMatchObject({
      productId: 'pantalon-con-cierre',
      reason: 'otherProduct',
      // 45500 + 48500 = 94000 contra 85000 de combo.
      savings: 9000,
    });
  });

  it('avisa al reves si lo que hay es el pantalon', () => {
    const nearby = nearbyPromotions([pantalon('M', 'large')], [COMBO], priceOf);

    expect(nearby[0]).toMatchObject({ productId: 'buzo-medio-cierre', reason: 'otherProduct' });
  });

  it('usa el precio del tramo de la prenda que ya esta en el carrito', () => {
    const nearby = nearbyPromotions([buzo('8', 'small')], [COMBO], priceOf);

    // 41000 + 44000 = 85000 contra 75000 del combo chico.
    expect(nearby[0]?.savings).toBe(10000);
  });

  it('no avisa nada cuando el combo ya esta armado', () => {
    const nearby = nearbyPromotions(
      [buzo('M', 'large'), pantalon('M', 'large')],
      [COMBO],
      priceOf,
    );

    expect(nearby).toEqual([]);
  });

  it('avisa que con otro talle del mismo producto entra la promo familia', () => {
    const nearby = nearbyPromotions([remera('M', 'large')], [FAMILIA], priceOf);

    expect(nearby[0]).toMatchObject({
      productId: 'remera-algodon',
      reason: 'anotherSize',
      // Depende de que talle elija: inventar un numero seria mentir.
      savings: null,
    });
  });

  it('no avisa de la promo familia si ya hay dos talles del producto', () => {
    const nearby = nearbyPromotions([remera('M', 'large'), remera('12', 'small')], [FAMILIA], priceOf);

    expect(nearby.filter((item) => item.definition.id === 'familia-camg')).toEqual([]);
  });

  it('un carrito vacio no sugiere nada', () => {
    expect(nearbyPromotions([], [COMBO, FAMILIA], priceOf)).toEqual([]);
  });

  it('una promo apagada no se sugiere', () => {
    const nearby = nearbyPromotions([buzo('M', 'large')], [{ ...COMBO, isActive: false }], priceOf);

    expect(nearby).toEqual([]);
  });
});
