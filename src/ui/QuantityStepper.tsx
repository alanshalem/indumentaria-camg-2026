import styles from './QuantityStepper.module.css';

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

/** Control +/- compartido por la ficha de producto y el carrito. */
export function QuantityStepper({ value, onChange, min = 1, max = 50, label = 'Cantidad' }: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className={styles.control} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Restar uno"
      >
        &minus;
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Sumar uno"
      >
        +
      </button>
    </div>
  );
}
