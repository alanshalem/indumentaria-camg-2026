import { useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { Product } from '@shared/domain/product';
import type { ComboConfig, PromotionDefinition, SameProductConfig } from '@shared/domain/promotions';
import { Button } from '@/ui';
import styles from './PromotionsPanel.module.css';

interface Props {
  promotion: PromotionDefinition;
  catalog: readonly Product[];
  kindLabel: string;
  isBusy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const asCombo = (config: unknown): ComboConfig | null => {
  const candidate = config as ComboConfig | null;
  return candidate && Array.isArray(candidate.productIds) && 'bundlePriceLarge' in candidate
    ? candidate
    : null;
};

const asSameProduct = (config: unknown): SameProductConfig | null => {
  const candidate = config as SameProductConfig | null;
  return candidate && typeof candidate.percentOff === 'number' ? candidate : null;
};

export function PromotionCard({
  promotion,
  catalog,
  kindLabel,
  isBusy,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  // Dos pasos para borrar: es destructivo y no hay papelera.
  const [confirming, setConfirming] = useState(false);

  const nameOf = (id: string) => catalog.find((product) => product.id === id)?.name ?? id;

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
          title={promotion.isActive ? 'Apagar esta promo' : 'Encender esta promo'}
        >
          {promotion.isActive ? 'Activa' : 'Apagada'}
        </button>
      </header>

      <div className={styles.cardBody}>
        <ConfigSummary promotion={promotion} nameOf={nameOf} />

        {confirming ? (
          <div className={styles.confirm}>
            <span>¿Eliminar &laquo;{promotion.label}&raquo;? No se puede deshacer.</span>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isBusy}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
                loading={isBusy}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.cardActions}>
            <Button variant="ghost" onClick={onEdit} disabled={isBusy}>
              Editar
            </Button>
            <button
              type="button"
              className={styles.delete}
              onClick={() => setConfirming(true)}
              disabled={isBusy}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function ConfigSummary({
  promotion,
  nameOf,
}: {
  promotion: PromotionDefinition;
  nameOf: (id: string) => string;
}) {
  const combo = asCombo(promotion.config);
  if (combo) {
    return (
      <dl className={styles.summary}>
        <div>
          <dt>Productos</dt>
          <dd>{combo.productIds.map(nameOf).join(' + ')}</dd>
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
        <div>
          <dt>Aplica a</dt>
          <dd>
            {sameProduct.productIds.length === 0 ? (
              // Sin productos elegidos la promo no descuenta nada: se dice, no
              // se deja al club adivinando por qué no aparece en el carrito.
              <em className={styles.warn}>ningún producto · la promo no se aplica</em>
            ) : (
              sameProduct.productIds.map(nameOf).join(', ')
            )}
          </dd>
        </div>
      </dl>
    );
  }

  return <p className={styles.unknown}>Configuración no reconocida para este tipo de promo.</p>;
}
