import { useCatalogStore } from '@/store/catalogStore';
import styles from './PromoBanner.module.css';

/** Las promos vigentes, dichas antes de que el socio arme el carrito. */
export function PromoBanner() {
  const promotions = useCatalogStore((state) => state.promotions);
  if (promotions.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Promociones vigentes">
      <div className={`container ${styles.inner}`}>
        <span className={styles.eyebrow}>Promos vigentes</span>
        <ul className={styles.list}>
          {promotions.map((promotion) => (
            <li key={promotion.id} className={styles.item}>
              <strong className={styles.label}>{promotion.label}</strong>
              <span className={styles.detail}>{promotion.description}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>Se aplican solas al cargar los productos en el carrito.</p>
      </div>
    </section>
  );
}
