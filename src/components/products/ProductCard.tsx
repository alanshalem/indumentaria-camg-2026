import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '@shared/domain/money';
import {
  allSizes,
  imageForColor,
  priceForTier,
  sizeTierOf,
  type Product,
} from '@shared/domain/product';
import { promotionNamesProduct } from '@shared/domain/promotions';
import { productPath } from '@/app/paths';
import { useCartStore } from '@/store/cartStore';
import { useCatalogStore } from '@/store/catalogStore';
import { Button, ChipGroup, ColorSwatches } from '@/ui';
import styles from './ProductCard.module.css';

const FEEDBACK_MS = 1600;

export function ProductCard({ product }: { product: Product }) {
  const sizes = useMemo(() => allSizes(product), [product]);
  const [size, setSize] = useState(() => sizes[0] ?? '');
  const [color, setColor] = useState<string | null>(() => product.colors[0]?.name ?? null);
  const [justAdded, setJustAdded] = useState(false);

  const addLine = useCartStore((state) => state.addLine);
  const openCart = useCartStore((state) => state.openCart);
  const promotions = useCatalogStore((state) => state.promotions);

  // El precio es el del talle elegido, sin etiquetas al lado: el número que se
  // ve es el que se paga.
  const tier = sizeTierOf(product, size);
  const unitPrice = tier ? priceForTier(product, tier) : product.priceLarge;
  const image = imageForColor(product, color);

  const combo = promotions.find((promotion) => promotionNamesProduct(promotion, product.id));

  function handleAdd() {
    if (!tier) return;
    addLine({
      productId: product.id,
      productName: product.name,
      size,
      sizeTier: tier,
      color,
      quantity: 1,
      unitPrice,
      image,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), FEEDBACK_MS);
    openCart();
  }

  return (
    <article className={styles.card}>
      <Link to={productPath(product.id)} className={styles.media} aria-label={`Ver ${product.name}`}>
        <img src={image} alt={product.name} loading="lazy" />
        {combo && <span className={styles.badge}>{combo.label}</span>}
        <span className={styles.mediaHint}>Ver detalle</span>
      </Link>

      <div className={styles.body}>
        <div className={styles.heading}>
          <h3 className={styles.name}>
            <Link to={productPath(product.id)}>{product.name}</Link>
          </h3>
          {product.description && <p className={styles.desc}>{product.description}</p>}
        </div>

        <p className={styles.price}>{formatPrice(unitPrice)}</p>

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
          <span className={styles.label}>Talle</span>
          <ChipGroup
            options={sizes}
            selected={size}
            onSelect={setSize}
            ariaLabel={`Talles de ${product.name}`}
          />
        </div>

        <Button block onClick={handleAdd} disabled={!tier} className={styles.cta}>
          {justAdded ? '✓ Agregado' : 'Agregar al carrito'}
        </Button>
      </div>
    </article>
  );
}
