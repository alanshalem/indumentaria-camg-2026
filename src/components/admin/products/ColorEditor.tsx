import type { ProductColor } from '@shared/domain/product';
import { Button } from '@/ui';
import { ImagePicker } from './ImagePicker';
import styles from './ColorEditor.module.css';

interface Props {
  colors: ProductColor[];
  error?: string | undefined;
  onChange: (colors: ProductColor[]) => void;
  onError?: (message: string) => void;
}

const NEW_COLOR: ProductColor = { name: '', hex: '#DC143C', imageUrl: null };

/**
 * Editor de variantes de color.
 *
 * Cada color es una tarjeta con sus tres campos rotulados —nombre, muestra y
 * foto— en vez de una fila de inputs sueltos donde no se entendía qué era qué.
 * Dejar la lista vacía significa "este producto no se elige por color": es la
 * diferencia entre una campera sublimada y una remera que viene en tres colores.
 */
export function ColorEditor({ colors, error, onChange, onError }: Props) {
  const patch = (index: number, changes: Partial<ProductColor>) =>
    onChange(colors.map((color, i) => (i === index ? { ...color, ...changes } : color)));

  return (
    <div className={styles.editor}>
      {colors.length === 0 ? (
        <p className={styles.empty}>
          Sin colores: el producto se vende sin que el socio tenga que elegir uno.
        </p>
      ) : (
        <ul className={styles.list}>
          {colors.map((color, index) => (
            <li key={index} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.position}>Color {index + 1}</span>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => onChange(colors.filter((_, i) => i !== index))}
                >
                  Quitar
                </button>
              </div>

              <div className={styles.fields}>
                <label className={styles.nameField}>
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={color.name}
                    maxLength={30}
                    placeholder="Roja"
                    onChange={(event) => patch(index, { name: event.target.value })}
                  />
                </label>

                <label className={styles.hexField}>
                  <span>Muestra</span>
                  <span className={styles.hexControl}>
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(event) => patch(index, { hex: event.target.value })}
                      aria-label={`Muestra del color ${color.name || index + 1}`}
                    />
                    <code>{color.hex.toUpperCase()}</code>
                  </span>
                </label>
              </div>

              <div className={styles.photo}>
                <span className={styles.photoLabel}>Foto de esta variante</span>
                <ImagePicker
                  variant="compact"
                  value={color.imageUrl ?? ''}
                  onChange={(imageUrl) => patch(index, { imageUrl: imageUrl || null })}
                  {...(onError ? { onError } : {})}
                />
                <span className={styles.photoHint}>
                  Si la dejás vacía se usa la foto principal del producto.
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <Button variant="ghost" onClick={() => onChange([...colors, { ...NEW_COLOR }])}>
        + Agregar color
      </Button>
    </div>
  );
}
