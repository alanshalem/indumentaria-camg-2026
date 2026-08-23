import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '@shared/domain/money';
import { priceForTier, type SizeTier } from '@shared/domain/product';
import { nearbyPromotions } from '@shared/domain/promotions';
import { productPath } from '@/app/paths';
import { cartUnits, useCartStore } from '@/store/cartStore';
import { useCatalogStore } from '@/store/catalogStore';
import styles from './PromoNudge.module.css';

/**
 * "Te falta una prenda para el combo".
 *
 * Las promos estaban anunciadas arriba de todo, lejos del momento en que el
 * socio decide. Esto aparece donde se decide —el carrito— y sólo cuando de
 * verdad está a un producto de distancia.
 */
export function PromoNudge() {
  const lines = useCartStore((state) => state.lines);
  const closeCart = useCartStore((state) => state.closeCart);
  const promotions = useCatalogStore((state) => state.promotions);
  const catalog = useCatalogStore((state) => state.products);

  const nearby = useMemo(() => {
    const priceOf = (productId: string, tier: SizeTier) => {
      const product = catalog.find((item) => item.id === productId);
      return product ? priceForTier(product, tier) : null;
    };

    return nearbyPromotions(cartUnits(lines), promotions, priceOf);
  }, [lines, promotions, catalog]);

  if (nearby.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {nearby.map((item) => {
        const product = catalog.find((entry) => entry.id === item.productId);
        if (!product) return null;

        return (
          <div key={`${item.definition.id}-${item.productId}`} className={styles.card}>
            <span className={styles.label}>{item.definition.label}</span>

            <p className={styles.text}>
              {item.reason === 'otherProduct' ? (
                <>
                  Agregá <strong>{product.name}</strong> y se activa el combo
                  {item.savings !== null && item.savings > 0 && (
                    <>
                      : ahorrás <strong>{formatPrice(item.savings)}</strong>
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  Sumá otro <strong>{product.name}</strong> en otro talle y se activa.
                </>
              )}
            </p>

            {item.definition.description && (
              <p className={styles.detail}>{item.definition.description}</p>
            )}

            <Link to={productPath(product.id)} className={styles.link} onClick={closeCart}>
              Ver {product.name} →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
