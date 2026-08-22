import { useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { ComboConfig, PromotionDefinition, SameProductConfig } from '@shared/domain/promotions';
import { Button, Field } from '@/ui';
import styles from './PromotionsPanel.module.css';

interface Props {
  promotion: PromotionDefinition;
  kindLabel: string;
  isBusy: boolean;
  onToggle: () => void;
  onSaveConfig: (config: unknown) => void;
}

const asCombo = (config: unknown): ComboConfig | null => {
  const candidate = config as ComboConfig | null;
  return candidate && Array.isArray(candidate.productIds) ? candidate : null;
};

const asSameProduct = (config: unknown): SameProductConfig | null => {
  const candidate = config as SameProductConfig | null;
  return candidate && typeof candidate.percentOff === 'number' ? candidate : null;
};

export function PromotionCard({ promotion, kindLabel, isBusy, onToggle, onSaveConfig }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <article className={`${styles.card} ${promotion.isActive ? '' : styles.cardOff}`}>
      <header className={styles.cardHead}>
        <div>
          <span className={styles.kind}>{kindLabel}</span>
          <h3 className={styles.cardTitle}>{promotion.label}</h3>
          <p className={styles.cardDesc}>{promotion.description}</p>
        </div>
        <button
          type="button"
          className={`${styles.pill} ${promotion.isActive ? styles.on : styles.off}`}
          onClick={onToggle}
          disabled={isBusy}
        >
          {promotion.isActive ? 'Activa' : 'Apagada'}
        </button>
      </header>

      {isEditing ? (
        <ConfigEditor
          promotion={promotion}
          isBusy={isBusy}
          onCancel={() => setIsEditing(false)}
          onSave={(config) => {
            onSaveConfig(config);
            setIsEditing(false);
          }}
        />
      ) : (
        <div className={styles.cardBody}>
          <ConfigSummary promotion={promotion} />
          <Button variant="ghost" onClick={() => setIsEditing(true)} disabled={isBusy}>
            Editar valores
          </Button>
        </div>
      )}
    </article>
  );
}

function ConfigSummary({ promotion }: { promotion: PromotionDefinition }) {
  const combo = asCombo(promotion.config);
  if (combo) {
    return (
      <dl className={styles.summary}>
        <div>
          <dt>Productos</dt>
          <dd>{combo.productIds.join(' + ')}</dd>
        </div>
        <div>
          <dt>Precio combo grandes</dt>
          <dd>{formatPrice(combo.bundlePriceLarge)}</dd>
        </div>
        <div>
          <dt>Precio combo chicos</dt>
          <dd>{formatPrice(combo.bundlePriceSmall)}</dd>
        </div>
      </dl>
    );
  }

  const sameProduct = asSameProduct(promotion.config);
  if (sameProduct) {
    return (
      <dl className={styles.summary}>
        <div>
          <dt>Descuento</dt>
          <dd>{sameProduct.percentOff}% sobre la unidad más barata</dd>
        </div>
      </dl>
    );
  }

  return <p className={styles.unknown}>Configuración no reconocida para este tipo de promo.</p>;
}

function ConfigEditor({
  promotion,
  isBusy,
  onCancel,
  onSave,
}: {
  promotion: PromotionDefinition;
  isBusy: boolean;
  onCancel: () => void;
  onSave: (config: unknown) => void;
}) {
  const combo = asCombo(promotion.config);
  const sameProduct = asSameProduct(promotion.config);

  const [large, setLarge] = useState(String(combo?.bundlePriceLarge ?? 0));
  const [small, setSmall] = useState(String(combo?.bundlePriceSmall ?? 0));
  const [percent, setPercent] = useState(String(sameProduct?.percentOff ?? 10));

  function handleSave() {
    if (combo) {
      onSave({
        ...combo,
        bundlePriceLarge: Number(large) || 0,
        bundlePriceSmall: Number(small) || 0,
      });
      return;
    }
    if (sameProduct) onSave({ percentOff: Number(percent) || 0 });
  }

  return (
    <div className={styles.editor}>
      {combo && (
        <div className={styles.editorRow}>
          <Field
            label="Precio combo · talles grandes"
            type="number"
            min={0}
            step={500}
            value={large}
            onChange={(event) => setLarge(event.target.value)}
            hint={formatPrice(Number(large) || 0)}
          />
          <Field
            label="Precio combo · talles chicos"
            type="number"
            min={0}
            step={500}
            value={small}
            onChange={(event) => setSmall(event.target.value)}
            hint={formatPrice(Number(small) || 0)}
          />
        </div>
      )}

      {sameProduct && (
        <Field
          label="Descuento (%)"
          type="number"
          min={1}
          max={90}
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          hint="Se aplica sobre la unidad más barata de cada par."
        />
      )}

      <div className={styles.editorActions}>
        <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
          Cancelar
        </Button>
        <Button onClick={handleSave} loading={isBusy}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
