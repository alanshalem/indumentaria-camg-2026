import type { ProductColor } from '@shared/domain/product';
import { Button, FieldShell } from '@/ui';
import { ImagePicker } from './ImagePicker';
import styles from './ProductForm.module.css';

interface Props {
  colors: ProductColor[];
  error?: string | undefined;
  onChange: (colors: ProductColor[]) => void;
}

const NEW_COLOR: ProductColor = { name: '', hex: '#DC143C', imageUrl: null };

/**
 * Editor de variantes de color. Dejarlo vacío significa "este producto no se
 * elige por color" — es la diferencia entre una campera sublimada y una remera
 * que viene en blanca, negra y roja.
 */
export function ColorEditor({ colors, error, onChange }: Props) {
  const patch = (index: number, changes: Partial<ProductColor>) =>
    onChange(colors.map((color, i) => (i === index ? { ...color, ...changes } : color)));

  return (
    <FieldShell
      label="Colores"
      error={error}
      hint="Si no cargás ninguno, el producto se vende sin elección de color."
    >
      <div className={styles.colorList}>
        {colors.map((color, index) => (
          <div key={index} className={styles.colorRow}>
            <input
              type="color"
              className={styles.colorPicker}
              value={color.hex}
              onChange={(event) => patch(index, { hex: event.target.value })}
              aria-label={`Muestra del color ${index + 1}`}
            />
            <input
              type="text"
              value={color.name}
              maxLength={30}
              placeholder="Nombre (ej: Roja)"
              aria-label={`Nombre del color ${index + 1}`}
              onChange={(event) => patch(index, { name: event.target.value })}
            />
            <ImagePicker
              value={color.imageUrl ?? ''}
              placeholder="Foto de esta variante (opcional)"
              onChange={(imageUrl) => patch(index, { imageUrl: imageUrl || null })}
            />
            <button
              type="button"
              className={styles.removeColor}
              onClick={() => onChange(colors.filter((_, i) => i !== index))}
              aria-label={`Quitar el color ${color.name || index + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <Button variant="ghost" onClick={() => onChange([...colors, { ...NEW_COLOR }])}>
        + Agregar color
      </Button>
    </FieldShell>
  );
}
