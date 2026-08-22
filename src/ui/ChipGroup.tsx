import styles from './ChipGroup.module.css';

interface Props {
  options: readonly string[];
  /** Selección simple (`string`) o múltiple (`string[]`). */
  selected: string | string[];
  onSelect: (option: string) => void;
  ariaLabel: string;
}

const isSelected = (selected: Props['selected'], option: string): boolean =>
  Array.isArray(selected) ? selected.includes(option) : selected === option;

/** Chips de talle. Los usa la ficha de producto y el formulario del admin. */
export function ChipGroup({ options, selected, onSelect, ariaLabel }: Props) {
  return (
    <div className={styles.group} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = isSelected(selected, option);
        return (
          <button
            key={option}
            type="button"
            className={`${styles.chip} ${active ? styles.active : ''}`}
            aria-pressed={active}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
