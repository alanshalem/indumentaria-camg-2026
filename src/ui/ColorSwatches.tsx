import type { ProductColor } from '@shared/domain/product';
import styles from './ColorSwatches.module.css';

interface Props {
  colors: readonly ProductColor[];
  selected: string | null;
  onSelect: (name: string) => void;
  ariaLabel: string;
}

/** Muestras de color. El chip lleva el nombre al lado para no depender sólo del color. */
export function ColorSwatches({ colors, selected, onSelect, ariaLabel }: Props) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
      {colors.map((color) => {
        const active = color.name === selected;
        return (
          <button
            key={color.name}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.swatch} ${active ? styles.active : ''}`}
            onClick={() => onSelect(color.name)}
          >
            <span className={styles.dot} style={{ background: color.hex }} aria-hidden="true" />
            {color.name}
          </button>
        );
      })}
    </div>
  );
}
