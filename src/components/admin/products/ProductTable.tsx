import { formatPrice } from '@shared/domain/money.js';
import { sizeRangeLabel, type Product } from '@shared/domain/product.js';
import { EmptyState } from '@/ui';
import styles from './ProductTable.module.css';

interface Props {
  products: readonly Product[];
  busyId: string | null;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onDelete: (product: Product) => void;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

/** Precio de un tramo con el rango de talles al que se aplica. */
function TierCell({ price, sizes }: { price: number; sizes: readonly string[] }) {
  if (sizes.length === 0) return <span className={styles.none}>—</span>;

  return (
    <>
      <span className={styles.price}>{formatPrice(price)}</span>
      {/* El detalle completo queda en el tooltip: la tabla se lee de un vistazo. */}
      <span className={styles.range} title={sizes.join(' · ')}>
        {sizeRangeLabel(sizes)}
      </span>
    </>
  );
}

export function ProductTable({ products, busyId, onEdit, onToggleActive, onDelete }: Props) {
  if (products.length === 0) {
    return <EmptyState title="Todavía no hay productos cargados." />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thumbCol}>
              <span className="sr-only">Foto</span>
            </th>
            <th>Producto</th>
            <th className={styles.right}>Talles chicos</th>
            <th className={styles.right}>Talles grandes</th>
            <th>Estado</th>
            <th className={styles.actionsCol}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const isBusy = busyId === product.id;
            return (
              <tr key={product.id} className={product.isActive ? '' : styles.inactiveRow}>
                <td>
                  <img className={styles.thumb} src={product.imageUrl} alt="" loading="lazy" />
                </td>

                <td>
                  <button type="button" className={styles.name} onClick={() => onEdit(product)}>
                    {product.name}
                  </button>
                  <span className={styles.id}>{product.id}</span>
                  {product.colors.length > 0 && (
                    <span className={styles.colors}>
                      {product.colors.map((color) => (
                        <span
                          key={color.name}
                          className={styles.colorDot}
                          style={{ background: color.hex }}
                          title={color.name}
                        />
                      ))}
                      <span className={styles.colorCount}>
                        {product.colors.length} color{product.colors.length === 1 ? '' : 'es'}
                      </span>
                    </span>
                  )}
                </td>

                <td className={styles.right}>
                  <TierCell price={product.priceSmall} sizes={product.sizesSmall} />
                </td>
                <td className={styles.right}>
                  <TierCell price={product.priceLarge} sizes={product.sizesLarge} />
                </td>

                <td>
                  <button
                    type="button"
                    className={`${styles.pill} ${product.isActive ? styles.active : styles.inactive}`}
                    onClick={() => onToggleActive(product)}
                    disabled={isBusy}
                    title={product.isActive ? 'Ocultar del catálogo' : 'Publicar en el catálogo'}
                  >
                    {product.isActive ? 'Visible' : 'Oculto'}
                  </button>
                </td>

                {/* El flex va en un div, no en el <td>: aplicarlo a la celda le
                    quita el display table-cell y la fila se desalinea. */}
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => onEdit(product)}
                      disabled={isBusy}
                      title={`Editar ${product.name}`}
                      aria-label={`Editar ${product.name}`}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.danger}`}
                      onClick={() => onDelete(product)}
                      disabled={isBusy}
                      title={`Eliminar ${product.name}`}
                      aria-label={`Eliminar ${product.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className={styles.footNote}>
        {products.length} producto{products.length === 1 ? '' : 's'} · el orden de la tabla es el
        mismo que ve el socio en el catálogo.
      </p>
    </div>
  );
}
