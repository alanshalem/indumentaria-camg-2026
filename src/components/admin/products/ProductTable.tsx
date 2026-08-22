import { formatPrice } from '@shared/domain/money';
import { allSizes, type Product } from '@shared/domain/product';
import { EmptyState } from '@/ui';
import styles from './ProductTable.module.css';

interface Props {
  products: readonly Product[];
  busyId: string | null;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onDelete: (product: Product) => void;
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
            <th className={styles.thumbCol} />
            <th>Producto</th>
            <th>Talles</th>
            <th className={styles.right}>Chicos</th>
            <th className={styles.right}>Grandes</th>
            <th>Estado</th>
            <th />
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
                  <span className={styles.name}>{product.name}</span>
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
                    </span>
                  )}
                </td>
                <td className={styles.sizes}>{allSizes(product).join(' · ')}</td>
                <td className={styles.right}>
                  {product.sizesSmall.length > 0 ? formatPrice(product.priceSmall) : '—'}
                </td>
                <td className={styles.right}>
                  {product.sizesLarge.length > 0 ? formatPrice(product.priceLarge) : '—'}
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
                <td className={styles.rowActions}>
                  <button type="button" onClick={() => onEdit(product)} disabled={isBusy}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => onDelete(product)}
                    disabled={isBusy}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
