import { PRODUCT_CATEGORY_LABELS, type Product } from '@shared/domain/product';
import { formatPrice } from '@shared/domain/money';
import styles from './ProductPicker.module.css';

interface Props {
  label: string;
  hint?: string;
  catalog: readonly Product[];
  selected: readonly string[];
  /** Tope de selección. El combo son exactamente dos. */
  max?: number;
  onChange: (ids: string[]) => void;
}

/**
 * Elige productos por nombre, no por identificador.
 *
 * El club razona en "campera" y "pantalón"; los `productId` son un detalle de
 * la base. Con un `max`, elegir uno más descarta el más viejo en vez de
 * bloquear el click: cambiar de opinión sobre un combo no debería obligar a
 * destildar primero.
 */
export function ProductPicker({ label, hint, catalog, selected, max, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((current) => current !== id));
      return;
    }

    const next = [...selected, id];
    onChange(max ? next.slice(-max) : next);
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>
        {label}
        {max && (
          <em className={styles.counter}>
            {selected.length}/{max}
          </em>
        )}
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}

      <div className={styles.grid}>
        {catalog.map((product) => {
          const isOn = selected.includes(product.id);
          const order = selected.indexOf(product.id);

          return (
            <button
              key={product.id}
              type="button"
              className={`${styles.item} ${isOn ? styles.on : ''}`}
              onClick={() => toggle(product.id)}
              aria-pressed={isOn}
            >
              <span className={styles.name}>
                {max === 2 && isOn && <em className={styles.badge}>{order + 1}</em>}
                {product.name}
              </span>
              <span className={styles.meta}>
                {PRODUCT_CATEGORY_LABELS[product.category]} · desde{' '}
                {formatPrice(Math.min(product.priceSmall, product.priceLarge))}
              </span>
            </button>
          );
        })}
      </div>

      {catalog.length === 0 && (
        <p className={styles.empty}>No hay productos cargados para asociar a la promo.</p>
      )}
    </div>
  );
}
