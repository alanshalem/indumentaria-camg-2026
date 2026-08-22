import { useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  allSizes,
  imageForColor,
  priceForTier,
  sizeTierOf,
  SIZE_TIER_LABELS,
  type Product,
  type SizeTier,
} from '@shared/domain/product';
import { useCartStore } from '@/store/cartStore';
import { useSizeChartStore } from '@/store/sizeChartStore';
import { Button, ChipGroup, ColorSwatches, QuantityStepper } from '@/ui';
import styles from './ProductCard.module.css';

const FEEDBACK_MS = 1500;

/** Grupos de talle a dibujar: sólo los tiers que el producto realmente tiene. */
const tierGroups = (product: Product): Array<{ tier: SizeTier; sizes: string[] }> =>
  [
    { tier: 'small' as const, sizes: product.sizesSmall },
    { tier: 'large' as const, sizes: product.sizesLarge },
  ].filter((group) => group.sizes.length > 0);

export function ProductCard({ product }: { product: Product }) {
  const groups = useMemo(() => tierGroups(product), [product]);
  const [size, setSize] = useState(() => allSizes(product)[0] ?? '');
  const [color, setColor] = useState<string | null>(() => product.colors[0]?.name ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const addLine = useCartStore((state) => state.addLine);
  const openCart = useCartStore((state) => state.openCart);
  const openSizeChart = useSizeChartStore((state) => state.open);

  const tier = sizeTierOf(product, size);
  const unitPrice = tier ? priceForTier(product, tier) : product.priceLarge;
  const image = imageForColor(product, color);
  // Con un solo tier el precio es uno solo: mostrar dos columnas sería ruido.
  const showsTierPrices = groups.length > 1 && product.priceSmall !== product.priceLarge;

  function handleAdd() {
    if (!tier) return;
    addLine({
      productId: product.id,
      productName: product.name,
      size,
      sizeTier: tier,
      color,
      quantity,
      unitPrice,
      image,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), FEEDBACK_MS);
    openCart();
  }

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <img src={image} alt={product.name} loading="lazy" />
      </div>

      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        {product.description && <p className={styles.desc}>{product.description}</p>}

        <p className={styles.price}>
          {formatPrice(unitPrice)}
          {tier && showsTierPrices && (
            <span className={styles.priceTier}>{SIZE_TIER_LABELS[tier]}</span>
          )}
        </p>

        {product.colors.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Color</span>
            <ColorSwatches
              colors={product.colors}
              selected={color}
              onSelect={setColor}
              ariaLabel={`Colores de ${product.name}`}
            />
          </div>
        )}

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span className={styles.label}>Talle</span>
            {product.sizeChartId && (
              <button
                type="button"
                className={styles.chartLink}
                onClick={() => openSizeChart(product.sizeChartId!)}
              >
                Ver tabla de talles
              </button>
            )}
          </div>

          {groups.map((group) => (
            <div key={group.tier} className={styles.sizeGroup}>
              {showsTierPrices && (
                <span className={styles.sizeGroupLabel}>
                  {SIZE_TIER_LABELS[group.tier]} · {formatPrice(priceForTier(product, group.tier))}
                </span>
              )}
              <ChipGroup
                options={group.sizes}
                selected={size}
                onSelect={setSize}
                ariaLabel={`${SIZE_TIER_LABELS[group.tier]} de ${product.name}`}
              />
            </div>
          ))}
        </div>

        <div className={styles.qtyRow}>
          <span className={styles.label}>Cantidad</span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <Button block onClick={handleAdd} disabled={!tier} className={styles.cta}>
          {justAdded ? '✓ Agregado' : 'Agregar al carrito'}
        </Button>
      </div>
    </article>
  );
}
