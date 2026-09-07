import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatPrice } from '@shared/domain/money';
import {
  allSizes,
  imageForColor,
  initialSize,
  priceBands,
  priceForTier,
  priceRange,
  sizeTierOf,
  SIZE_TIER_LABELS,
  type Product,
} from '@shared/domain/product';
import { comboPartnerOf, promotionsForProduct } from '@shared/domain/promotions';
import { isOnDemand, ON_DEMAND_NOTICE, unitsFor } from '@shared/domain/stock';
import { SIZE_CHARTS, SIZE_CHART_NOTE } from '@shared/domain/sizeCharts';
import { SizeChartTable } from '@/components/products/SizeChartTable';
import { productPath } from '@/app/paths';
import { useCatalogProduct } from '@/hooks/useCatalogProduct';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCartStore } from '@/store/cartStore';
import { useCatalogStore } from '@/store/catalogStore';
import { useSizeChartStore } from '@/store/sizeChartStore';
import { Alert, Button, ChipGroup, ColorSwatches, QuantityStepper, Spinner } from '@/ui';
import { Picture } from '@/ui/Picture';
import styles from './ProductPage.module.css';

const FEEDBACK_MS = 1600;

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { product, status, error } = useCatalogProduct(id);

  useDocumentTitle(product?.name ?? null);

  if (status === 'loading') {
    return (
      <div className="centered-viewport">
        <Spinner size={28} label="Cargando producto…" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`container ${styles.notFound}`}>
        <Alert>{error}</Alert>
        <Link to="/" className="btn btn-ghost">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`container ${styles.notFound}`}>
        <h1>Ese producto no existe</h1>
        <p>Puede que lo hayamos sacado del catálogo o que el link esté mal.</p>
        <Link to="/#catalogo" className="btn btn-primary">
          Ver el catálogo
        </Link>
      </div>
    );
  }

  // `key` remonta el detalle al cambiar de producto: los talles y el color
  // elegidos son de ESE producto, no deben sobrevivir a la navegación.
  return <ProductDetail key={product.id} product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const sizes = useMemo(() => allSizes(product), [product]);
  const bands = useMemo(() => priceBands(product), [product]);

  const [size, setSize] = useState(() => initialSize(product));
  const [color, setColor] = useState<string | null>(() => product.colors[0]?.name ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const addLine = useCartStore((state) => state.addLine);
  const openCart = useCartStore((state) => state.openCart);
  const openSizeChart = useSizeChartStore((state) => state.open);
  const promotions = useCatalogStore((state) => state.promotions);
  const catalog = useCatalogStore((state) => state.products);

  const tier = sizeTierOf(product, size);
  const unitPrice = tier ? priceForTier(product, tier) : null;
  const range = useMemo(() => priceRange(product), [product]);
  const image = imageForColor(product, color);
  const chart = product.sizeChartId ? SIZE_CHARTS[product.sizeChartId] : null;

  const disponibles = tier ? unitsFor(product.stock, size, color) : null;
  const aPedido = Boolean(tier) && isOnDemand(product.stock, size, color);

  const applicable = useMemo(
    () => promotionsForProduct(product.id, promotions),
    [product.id, promotions],
  );
  const related = useMemo(
    () => catalog.filter((item) => item.id !== product.id).slice(0, 4),
    [catalog, product.id],
  );

  function handleAdd() {
    if (!tier) return;
    addLine({
      // Después del guard el tier existe, así que el precio se resuelve acá y
      // no depende del `unitPrice` que la vista deja en null sin talle elegido.
      unitPrice: priceForTier(product, tier),
      productId: product.id,
      productName: product.name,
      size,
      sizeTier: tier,
      color,
      quantity,
      image,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), FEEDBACK_MS);
    openCart();
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <nav className={styles.breadcrumb} aria-label="Migas de pan">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link to="/#catalogo">Catálogo</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className={styles.layout}>
          <section className={styles.gallery} aria-label={`Fotos de ${product.name}`}>
            <div className={styles.mainImage}>
              <Picture
                src={image}
                alt={product.name}
                sizes="(max-width: 900px) 92vw, 46vw"
                eager
              />
            </div>

            {product.colors.length > 1 && (
              <div className={styles.thumbs}>
                {product.colors.map((variant) => (
                  <button
                    key={variant.name}
                    type="button"
                    className={`${styles.thumb} ${variant.name === color ? styles.thumbActive : ''}`}
                    onClick={() => setColor(variant.name)}
                    aria-label={`Ver ${product.name} en ${variant.name}`}
                    aria-pressed={variant.name === color}
                  >
                    <Picture src={variant.imageUrl ?? product.imageUrl} alt="" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <h1 className={styles.title}>{product.name}</h1>
            {product.description && <p className={styles.description}>{product.description}</p>}

            <div className={styles.priceBlock}>
              <p className={styles.price}>
                {unitPrice === null && range.hasRange && <span className={styles.from}>Desde</span>}
                {formatPrice(unitPrice ?? range.min)}
              </p>
              <p className={styles.priceNote}>
                {tier ? `Precio del talle ${size}` : 'Elegí tu talle para ver el precio final'}
              </p>
            </div>

            {product.colors.length > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Color</span>
                <ColorSwatches
                  colors={product.colors}
                  selected={color}
                  onSelect={setColor}
                  ariaLabel={`Colores de ${product.name}`}
                />
              </div>
            )}

            <div className={styles.field}>
              <div className={styles.fieldHead}>
                <span className={styles.fieldLabel}>Talle</span>
                {chart && product.sizeChartId && (
                  <button
                    type="button"
                    className={styles.chartLink}
                    onClick={() => openSizeChart(product.sizeChartId!, size)}
                  >
                    Ver tabla de talles
                  </button>
                )}
              </div>

              <ChipGroup
                options={sizes}
                selected={size}
                onSelect={setSize}
                ariaLabel={`Talles de ${product.name}`}
              />

              {/* El precio cambia con el talle, así que se explica acá abajo y
                  no como una etiqueta pegada al número. */}
              {bands.length > 0 && (
                <ul className={styles.bands}>
                  {bands.map((band) => (
                    <li
                      key={band.tier}
                      className={`${styles.band} ${tier === band.tier ? styles.bandActive : ''}`}
                    >
                      <span className={styles.bandRange}>Talles {band.range}</span>
                      <span className={styles.bandPrice}>{formatPrice(band.price)}</span>
                      <span className={styles.bandTier}>{SIZE_TIER_LABELS[band.tier]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {aPedido && (
              <p className={styles.onDemand}>
                <strong>{ON_DEMAND_NOTICE}</strong>
                <span>Lo podés pedir igual: el club lo encarga y te avisa cuando llega.</span>
              </p>
            )}

            {disponibles !== null && disponibles > 0 && disponibles <= 3 && (
              <p className={styles.lowStock}>
                Quedan {disponibles} {disponibles === 1 ? 'unidad' : 'unidades'} de este talle.
              </p>
            )}

            <div className={styles.buyRow}>
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <Button onClick={handleAdd} disabled={!tier} className={styles.buyButton}>
                {justAdded ? '✓ Agregado al carrito' : tier ? 'Agregar al carrito' : 'Elegí un talle'}
              </Button>
            </div>

            <ul className={styles.trust}>
              <li>Retiro en la sede del club.</li>
              <li>Generás el pedido acá y el club te contacta para coordinar el pago.</li>
              <li>Te queda un código único para presentar al retirar.</li>
            </ul>
          </section>
        </div>

        {applicable.length > 0 && (
          <section className={styles.promos} aria-label="Promociones que aplican">
            <h2 className={styles.sectionTitle}>Promos que podés aprovechar</h2>
            <div className={styles.promoGrid}>
              {applicable.map((promotion) => {
                const partnerId = comboPartnerOf(promotion, product.id);
                const partner = partnerId
                  ? (catalog.find((item) => item.id === partnerId) ?? null)
                  : null;

                return (
                  <article key={promotion.id} className={styles.promoCard}>
                    <h3>{promotion.label}</h3>
                    <p>{promotion.description}</p>
                    {partner && (
                      <Link to={productPath(partner.id)} className={styles.promoLink}>
                        Ver {partner.name} →
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {chart && product.sizeChartId && (
          <section className={styles.chartSection} aria-label="Tabla de talles">
            <h2 className={styles.sectionTitle}>Tabla de talles · {chart.label}</h2>
            {/* Con el talle elegido resaltado: es la única fila que le importa. */}
            <SizeChartTable chart={chart} highlight={size} />
            <button
              type="button"
              className={styles.chartImage}
              onClick={() => openSizeChart(product.sizeChartId!, size)}
              aria-label="Ver dónde se toma cada medida"
            >
              <Picture src={chart.imageUrl} alt={chart.alt} sizes="(max-width: 900px) 92vw, 700px" />
            </button>
            <p className={styles.chartNote}>{SIZE_CHART_NOTE}</p>
          </section>
        )}

        {related.length > 0 && (
          <section className={styles.related} aria-label="Otros productos">
            <h2 className={styles.sectionTitle}>Seguí viendo</h2>
            <div className={styles.relatedGrid}>
              {related.map((item) => (
                <Link key={item.id} to={productPath(item.id)} className={styles.relatedCard}>
                  <Picture src={item.imageUrl} alt="" sizes="(max-width: 700px) 46vw, 220px" />
                  <span className={styles.relatedName}>{item.name}</span>
                  <span className={styles.relatedPrice}>
                    {/* `priceRange` sólo mira los tramos que tienen talles cargados. */}
                    Desde {formatPrice(priceRange(item).min)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
