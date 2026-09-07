import { useMemo, useState } from 'react';
import { allSizes, type Product } from '@shared/domain/product';
import { sameVariant, type StockLevel } from '@shared/domain/stock';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { Alert, Button } from '@/ui';
import styles from './StockEditor.module.css';

interface Props {
  product: Product;
  onSaved: (product: Product) => void;
  onCancel: () => void;
}

/** Los colores del producto, o una sola columna sin color. */
const columnsOf = (product: Product): (string | null)[] =>
  product.colors.length > 0 ? product.colors.map((color) => color.name) : [null];

/** Clave de celda: la misma variante que usa el carrito. */
const cellKey = (size: string, color: string | null) => `${size}|${color ?? ''}`;

/**
 * Grilla de stock: una fila por talle, una columna por color.
 *
 * Vacío y cero son cosas distintas. Vacío es "no llevo control de esta
 * variante": se vende sin avisar nada y sin descontar. Cero es "se me acabó":
 * ahí la venta sigue habilitada pero pasa a modalidad a pedido, con el plazo a
 * la vista. Por eso el input se puede dejar en blanco.
 */
export function StockEditor({ product, onSaved, onCancel }: Props) {
  const sizes = useMemo(() => allSizes(product), [product]);
  const columns = useMemo(() => columnsOf(product), [product]);

  const [grid, setGrid] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const size of sizes) {
      for (const color of columns) {
        const level = product.stock.find((entry) => sameVariant(entry, { size, color }));
        initial[cellKey(size, color)] = level ? String(level.units) : '';
      }
    }
    return initial;
  });

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const set = (size: string, color: string | null, value: string) =>
    setGrid((current) => ({ ...current, [cellKey(size, color)]: value }));

  /** Sólo las celdas con número: las vacías quedan fuera del inventario. */
  const levels = (): StockLevel[] =>
    sizes.flatMap((size) =>
      columns.flatMap((color) => {
        const raw = grid[cellKey(size, color)]?.trim() ?? '';
        if (raw === '') return [];

        const units = Number(raw);
        return Number.isFinite(units) && units >= 0
          ? [{ size, color, units: Math.floor(units) }]
          : [];
      }),
    );

  const cargadas = levels();
  const totalUnidades = cargadas.reduce((sum, level) => sum + level.units, 0);
  const agotadas = cargadas.filter((level) => level.units === 0).length;

  async function handleSave() {
    setError('');
    setIsSaving(true);
    try {
      onSaved(await catalogService.setStock(product.id, cargadas));
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo guardar el stock.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.help}>
        Poné las unidades que tenés físicamente de cada talle. En cero la venta{' '}
        <strong>sigue habilitada</strong> y pasa a «a pedido», con el plazo a la vista del socio.
        Dejarlo <strong>vacío</strong> es no llevar control de esa variante.
      </p>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Talle</th>
              {columns.map((color) => (
                <th key={color ?? 'unico'} scope="col">
                  {color ?? 'Unidades'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size}>
                <th scope="row">{size}</th>
                {columns.map((color) => {
                  const value = grid[cellKey(size, color)] ?? '';
                  return (
                    <td key={cellKey(size, color)}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        className={`${styles.input} ${value === '0' ? styles.zero : ''}`}
                        value={value}
                        placeholder="—"
                        aria-label={`Stock de ${product.name} talle ${size}${color ? ` ${color}` : ''}`}
                        onChange={(event) => set(size, color, event.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.summary}>
        {cargadas.length} {cargadas.length === 1 ? 'variante' : 'variantes'} con control ·{' '}
        {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'} en total
        {agotadas > 0 && ` · ${agotadas} agotada${agotadas === 1 ? '' : 's'} (a pedido)`}
      </p>

      <Alert>{error}</Alert>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={() => void handleSave()} loading={isSaving}>
          Guardar stock
        </Button>
      </div>
    </div>
  );
}
