import { useEffect } from 'react';
import { useCatalogStore } from '@/store/catalogStore';
import { Alert, Button, EmptyState } from '@/ui';
import { ProductCard } from './ProductCard';
import styles from './ProductGrid.module.css';

/** Tantos esqueletos como productos entran en una fila de escritorio. */
const SKELETONS = [0, 1, 2];

export function ProductGrid() {
  // El catálogo dejó de estar hardcodeado en el bundle: ahora lo sirve la API,
  // así el club puede cargar y editar productos sin un redeploy.
  const products = useCatalogStore((state) => state.products);
  const status = useCatalogStore((state) => state.status);
  const error = useCatalogStore((state) => state.error);
  const load = useCatalogStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const isFirstLoad = status === 'loading' && products.length === 0;

  return (
    <section className={styles.section} id="catalogo">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Catálogo 2026</span>
          <h2 className={styles.title}>Indumentaria oficial CAMG</h2>
          <p className={styles.sub}>Elegí tu talle y color. Generá tu pedido en un minuto.</p>
        </header>

        {status === 'error' && (
          <div className={styles.center}>
            <Alert>{error}</Alert>
            <Button variant="ghost" onClick={() => void load({ force: true })}>
              Reintentar
            </Button>
          </div>
        )}

        {status === 'ready' && products.length === 0 && (
          <EmptyState title="Todavía no hay productos publicados.">
            <p>Volvé en un rato: el club está cargando el catálogo de la temporada.</p>
          </EmptyState>
        )}

        {/* Esqueletos en vez de un spinner: la grilla no salta cuando llegan los datos. */}
        {isFirstLoad && (
          <div className={styles.grid} aria-hidden="true">
            {SKELETONS.map((index) => (
              <div key={index} className={styles.skeleton}>
                <div className={styles.skeletonMedia} />
                <div className={styles.skeletonBody}>
                  <span className={styles.skeletonLine} style={{ width: '70%' }} />
                  <span className={styles.skeletonLine} style={{ width: '90%' }} />
                  <span className={styles.skeletonLine} style={{ width: '40%', height: 26 }} />
                  <span className={styles.skeletonLine} style={{ width: '100%', height: 42 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
