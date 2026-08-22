import type { Ars } from './money.js';
import type { SizeTier } from './product.js';

/**
 * Motor de promociones.
 *
 * Vive en `shared/` a propósito: el carrito lo usa para previsualizar y el
 * servidor para calcular el total real del pedido. Al ser el mismo módulo, es
 * imposible que las dos puntas muestren números distintos.
 *
 * Regla estructural: **cada unidad participa como máximo de una promoción**.
 * Sin eso, dos reglas podrían descontar sobre la misma prenda y el total se
 * volvería imposible de explicar en el mostrador.
 */

export const PROMOTION_KINDS = ['combo', 'sameProductDifferentSize'] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const PROMOTION_KIND_LABELS: Record<PromotionKind, string> = {
  combo: 'Combo de dos productos',
  sameProductDifferentSize: 'Dos iguales de distinto talle',
};

export interface PromotionDefinition {
  id: string;
  kind: PromotionKind;
  label: string;
  description: string;
  /** Parámetros propios de cada `kind`; los valida la regla, no el motor. */
  config: unknown;
  isActive: boolean;
  sortOrder: number;
}

/** Configuración de `combo`: dos productos a precio de paquete. */
export interface ComboConfig {
  productIds: [string, string];
  bundlePriceLarge: Ars;
  bundlePriceSmall: Ars;
}

/** Configuración de `sameProductDifferentSize`: % sobre la unidad más barata. */
export interface SameProductConfig {
  percentOff: number;
}

/** Una prenda concreta del carrito, ya con su precio resuelto por talle. */
export interface PricedUnit {
  /** Identifica la línea de origen para poder explicar el descuento. */
  lineKey: string;
  productId: string;
  productName: string;
  size: string;
  tier: SizeTier;
  unitPrice: Ars;
}

export interface AppliedPromotion {
  id: string;
  kind: PromotionKind;
  label: string;
  detail: string;
  /** Monto descontado, siempre positivo. */
  amount: Ars;
}

export interface PromotionOutcome {
  subtotal: Ars;
  discounts: AppliedPromotion[];
  discountTotal: Ars;
  total: Ars;
}

interface RuleResult {
  discounts: AppliedPromotion[];
  consumed: PricedUnit[];
}

type PromotionRule = (units: readonly PricedUnit[], definition: PromotionDefinition) => RuleResult;

const NOTHING: RuleResult = { discounts: [], consumed: [] };

const sumPrices = (units: readonly PricedUnit[]): Ars =>
  units.reduce((total, unit) => total + unit.unitPrice, 0);

const byPriceAsc = (a: PricedUnit, b: PricedUnit) => a.unitPrice - b.unitPrice;

// ---------------------------------------------------------------------------
//  Regla: combo de dos productos a precio de paquete
// ---------------------------------------------------------------------------

const isComboConfig = (config: unknown): config is ComboConfig => {
  const candidate = config as ComboConfig | null;
  return (
    !!candidate &&
    Array.isArray(candidate.productIds) &&
    candidate.productIds.length === 2 &&
    typeof candidate.bundlePriceLarge === 'number' &&
    typeof candidate.bundlePriceSmall === 'number'
  );
};

/**
 * El precio chico sólo aplica si **las dos** prendas son de talle chico.
 * Un par mixto paga el precio grande: sigue siendo más barato que comprarlas
 * sueltas, y evita que un talle de niño abarate una prenda de adulto.
 */
const bundlePriceFor = (config: ComboConfig, first: PricedUnit, second: PricedUnit): Ars =>
  first.tier === 'small' && second.tier === 'small' ? config.bundlePriceSmall : config.bundlePriceLarge;

const combo: PromotionRule = (units, definition) => {
  if (!isComboConfig(definition.config)) return NOTHING;
  const config = definition.config;
  const [firstId, secondId] = config.productIds;
  if (firstId === secondId) return NOTHING;

  const pool = (productId: string, tier: SizeTier) =>
    units.filter((unit) => unit.productId === productId && unit.tier === tier).sort(byPriceAsc);

  const left = { small: pool(firstId, 'small'), large: pool(firstId, 'large') };
  const right = { small: pool(secondId, 'small'), large: pool(secondId, 'large') };

  const discounts: AppliedPromotion[] = [];
  const consumed: PricedUnit[] = [];

  // Se arman primero los pares del mismo tier (chico+chico ahorra más que
  // mixto) y recién después los cruzados, para maximizar el beneficio real.
  const pairings: Array<[PricedUnit[], PricedUnit[]]> = [
    [left.small, right.small],
    [left.large, right.large],
    [left.small, right.large],
    [left.large, right.small],
  ];

  for (const [leftPool, rightPool] of pairings) {
    while (leftPool.length > 0 && rightPool.length > 0) {
      const first = leftPool.pop()!;
      const second = rightPool.pop()!;
      const listPrice = first.unitPrice + second.unitPrice;
      const amount = listPrice - bundlePriceFor(config, first, second);

      // Un combo que no ahorra nada no se aplica: sería sólo ruido en el ticket.
      if (amount <= 0) continue;

      discounts.push({
        id: definition.id,
        kind: definition.kind,
        label: definition.label,
        detail: `${first.productName} (${first.size}) + ${second.productName} (${second.size})`,
        amount,
      });
      consumed.push(first, second);
    }
  }

  return { discounts, consumed };
};

// ---------------------------------------------------------------------------
//  Regla: dos productos iguales de distinto talle → % sobre el más barato
// ---------------------------------------------------------------------------

const isSameProductConfig = (config: unknown): config is SameProductConfig =>
  !!config && typeof (config as SameProductConfig).percentOff === 'number';

/**
 * Empareja unidades del mismo producto que tengan talles distintos.
 *
 * Se toma siempre una unidad de los dos talles más repetidos: así se forma la
 * cantidad máxima de pares válidos. Con 3 talles M y 1 talle L hay un solo par
 * legítimo (M+L), no dos — el segundo par sería M+M, que no califica.
 */
const sameProductDifferentSize: PromotionRule = (units, definition) => {
  if (!isSameProductConfig(definition.config)) return NOTHING;
  const percentOff = definition.config.percentOff;
  if (percentOff <= 0 || percentOff >= 100) return NOTHING;

  const discounts: AppliedPromotion[] = [];
  const consumed: PricedUnit[] = [];

  for (const [, productUnits] of groupBy(units, (unit) => unit.productId)) {
    const bySize = [...groupBy(productUnits, (unit) => unit.size).values()].map((group) =>
      [...group].sort(byPriceAsc),
    );

    for (;;) {
      // Los dos talles con más stock disponible en el carrito.
      const ranked = bySize.filter((group) => group.length > 0).sort((a, b) => b.length - a.length);
      if (ranked.length < 2) break;

      const first = ranked[0]!.pop()!;
      const second = ranked[1]!.pop()!;
      const cheaper = first.unitPrice <= second.unitPrice ? first : second;
      const amount = Math.round((cheaper.unitPrice * percentOff) / 100);

      if (amount > 0) {
        discounts.push({
          id: definition.id,
          kind: definition.kind,
          label: definition.label,
          detail: `${cheaper.productName}: talles ${first.size} y ${second.size} — ${percentOff}% sobre el más barato`,
          amount,
        });
      }
      consumed.push(first, second);
    }
  }

  return { discounts, consumed };
};

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

// ---------------------------------------------------------------------------
//  Motor
// ---------------------------------------------------------------------------

/** Registro de estrategias. Sumar una promo nueva = sumar una entrada acá. */
const RULES: Record<PromotionKind, PromotionRule> = {
  combo,
  sameProductDifferentSize,
};

export function evaluatePromotions(
  units: readonly PricedUnit[],
  definitions: readonly PromotionDefinition[],
): PromotionOutcome {
  const subtotal = sumPrices(units);
  let available = [...units];
  const discounts: AppliedPromotion[] = [];

  const active = definitions
    .filter((definition) => definition.isActive && definition.kind in RULES)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const definition of active) {
    const result = RULES[definition.kind](available, definition);
    if (result.consumed.length === 0) continue;

    discounts.push(...result.discounts);
    const spent = new Set(result.consumed);
    available = available.filter((unit) => !spent.has(unit));
  }

  const discountTotal = discounts.reduce((total, discount) => total + discount.amount, 0);

  return {
    subtotal,
    discounts,
    discountTotal,
    // Un bug en una config no puede dejar el total en negativo.
    total: Math.max(0, subtotal - discountTotal),
  };
}

/**
 * Si la promo nombra explícitamente a este producto. Sirve para anunciarla en
 * la ficha: "combiná con el pantalón y ahorrá".
 */
export const promotionNamesProduct = (
  definition: PromotionDefinition,
  productId: string,
): boolean =>
  definition.kind === 'combo' &&
  isComboConfig(definition.config) &&
  definition.config.productIds.includes(productId);

/**
 * Promos vigentes que puede llegar a disparar este producto. Las que no
 * dependen de un producto puntual —como la de dos iguales de distinto talle—
 * aplican a todo el catálogo.
 */
export const promotionsForProduct = (
  productId: string,
  definitions: readonly PromotionDefinition[],
): PromotionDefinition[] =>
  definitions.filter(
    (definition) =>
      definition.isActive &&
      (definition.kind !== 'combo' || promotionNamesProduct(definition, productId)),
  );

/** El otro producto del combo, para poder linkearlo desde la ficha. */
export const comboPartnerOf = (
  definition: PromotionDefinition,
  productId: string,
): string | null => {
  if (!isComboConfig(definition.config)) return null;
  return definition.config.productIds.find((id) => id !== productId) ?? null;
};

/**
 * Expande líneas de carrito (con cantidad) a unidades sueltas.
 * Las promociones razonan por prenda, no por línea: dos camperas en una misma
 * línea tienen que poder emparejarse por separado.
 */
export function expandUnits<T extends { quantity: number }>(
  lines: readonly T[],
  toUnit: (line: T, index: number) => PricedUnit,
): PricedUnit[] {
  return lines.flatMap((line, index) => {
    const unit = toUnit(line, index);
    return Array.from({ length: line.quantity }, () => ({ ...unit }));
  });
}
