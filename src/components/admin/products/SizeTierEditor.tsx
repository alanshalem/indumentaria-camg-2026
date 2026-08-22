import { useMemo, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  SIZE_PRESETS,
  SIZE_PRESET_LABELS,
  type SizePresetKey,
  type SizeTier,
} from '@shared/domain/product';
import { Button, ChipGroup, FieldShell } from '@/ui';
import styles from './ProductForm.module.css';

const PRESET_KEYS = Object.keys(SIZE_PRESETS) as SizePresetKey[];
const KNOWN_SIZES = [...new Set(PRESET_KEYS.flatMap((key) => [...SIZE_PRESETS[key]]))];

/** Los presets de niños sirven para el tier chico; los de adultos para el grande. */
const PRESETS_BY_TIER: Record<SizeTier, SizePresetKey[]> = {
  small: ['ninosBuzos', 'ninosRemeras', 'medias'],
  large: ['adultosBuzos', 'adultosPantalones', 'adultosRemeras', 'medias', 'unico'],
};

interface Props {
  tier: SizeTier;
  label: string;
  price: number;
  sizes: string[];
  /** Talles tomados por el otro tier: no se pueden repetir. */
  taken: string[];
  error?: string | undefined;
  onChange: (sizes: string[]) => void;
}

export function SizeTierEditor({ tier, label, price, sizes, taken, error, onChange }: Props) {
  const [custom, setCustom] = useState('');

  const options = useMemo(
    () => [...new Set([...KNOWN_SIZES, ...sizes])].filter((size) => !taken.includes(size)),
    [sizes, taken],
  );

  const toggle = (size: string) =>
    onChange(sizes.includes(size) ? sizes.filter((item) => item !== size) : [...sizes, size]);

  const addCustom = () => {
    const size = custom.trim();
    if (!size || sizes.includes(size) || taken.includes(size)) return;
    onChange([...sizes, size]);
    setCustom('');
  };

  return (
    <FieldShell
      label={`${label} · ${formatPrice(price)}`}
      error={error}
      hint={
        sizes.length === 0
          ? 'Sin talles en este tramo: nadie va a poder comprar a este precio.'
          : `${sizes.length} talle${sizes.length === 1 ? '' : 's'} a ${formatPrice(price)}.`
      }
    >
      <div className={styles.presets}>
        {PRESETS_BY_TIER[tier].map((key) => (
          <button
            key={key}
            type="button"
            className={styles.preset}
            onClick={() => onChange([...SIZE_PRESETS[key]].filter((size) => !taken.includes(size)))}
          >
            {SIZE_PRESET_LABELS[key]}
          </button>
        ))}
        {sizes.length > 0 && (
          <button type="button" className={styles.preset} onClick={() => onChange([])}>
            Vaciar
          </button>
        )}
      </div>

      <ChipGroup options={options} selected={sizes} onSelect={toggle} ariaLabel={label} />

      <div className={styles.customSize}>
        <input
          type="text"
          value={custom}
          maxLength={16}
          placeholder="Otro talle"
          aria-label={`Agregar un talle propio a ${label}`}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Enter agrega el talle; sin esto enviaría el formulario entero.
            event.preventDefault();
            addCustom();
          }}
        />
        <Button variant="ghost" onClick={addCustom} disabled={!custom.trim()}>
          Agregar
        </Button>
      </div>
    </FieldShell>
  );
}
