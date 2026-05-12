import ProductCard from './ProductCard.jsx';
import { products } from '../../data/products.js';
import styles from './ProductGrid.module.css';

export default function ProductGrid() {
  return (
    <section className={styles.section} id="catalogo">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Catálogo 2026</span>
          <h2 className={styles.title}>Indumentaria oficial CAMG</h2>
          <p className={styles.sub}>Elegí tu talle y color. Generá tu pedido en un minuto.</p>
        </header>

        <div className={styles.grid}>
          {products.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
