import { useMemo, useState } from 'react';
import { useCartStore } from '../../store/cartStore.js';
import { formatPrice } from '../../utils/formatters.js';
import styles from './ProductCard.module.css';

const COLOR_HEX = {
  Negro: '#0e0e0e',
  Rojo: '#DC143C',
  Blanco: '#ffffff',
  'Negro/Rojo': 'linear-gradient(135deg, #0e0e0e 50%, #DC143C 50%)',
};

export default function ProductCard({ product }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore(s => s.addItem);
  const openCart = useCartStore(s => s.openCart);

  const gallery = useMemo(
    () => product.gallery && product.gallery.length ? product.gallery : [product.image],
    [product]
  );
  const [imgIdx, setImgIdx] = useState(0);

  function handleAdd() {
    addItem({
      productId: product.id,
      productName: product.name,
      size,
      color,
      quantity: qty,
      unitPrice: product.price,
      image: product.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <img src={gallery[imgIdx]} alt={product.name} loading="lazy" />
        {gallery.length > 1 && (
          <div className={styles.thumbs}>
            {gallery.map((src, i) => (
              <button
                key={src}
                type="button"
                className={`${styles.thumb} ${i === imgIdx ? styles.thumbActive : ''}`}
                onClick={() => setImgIdx(i)}
                aria-label={`Imagen ${i + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        {product.description && <p className={styles.desc}>{product.description}</p>}
        <p className={styles.price}>{formatPrice(product.price)}</p>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colors}>
            {product.colors.map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.colorChip} ${c === color ? styles.colorActive : ''}`}
                style={{ background: COLOR_HEX[c] || '#666' }}
                onClick={() => setColor(c)}
                aria-label={c}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Talle</label>
          <div className={styles.sizes}>
            {product.sizes.map(s => (
              <button
                key={s}
                type="button"
                className={`${styles.sizeChip} ${s === size ? styles.sizeActive : ''}`}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.qtyRow}>
          <label className={styles.label}>Cantidad</label>
          <div className={styles.qtyControl}>
            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Restar">−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(q => q + 1)} aria-label="Sumar">+</button>
          </div>
        </div>

        <button
          type="button"
          className={`btn btn-primary btn-block ${styles.cta}`}
          onClick={() => { handleAdd(); openCart(); }}
        >
          {added ? '✓ Agregado' : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  );
}
