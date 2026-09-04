import { useState, type FormEvent } from 'react';
import { formatPrice } from '@shared/domain/money';
import type { Product } from '@shared/domain/product';
import {
  PROMOTION_KINDS,
  PROMOTION_KIND_LABELS,
  type ComboConfig,
  type PromotionDefinition,
  type PromotionKind,
  type SameProductConfig,
} from '@shared/domain/promotions';
import { promotionInputSchema } from '@shared/schemas/promotion.schema';
import { errorMessage } from '@/services/apiError';
import { promotionService } from '@/services/promotionService';
import { fieldErrorsFromApi, fieldErrorsFromZod } from '@/utils/formErrors';
import { Alert, Button, Field, SelectField } from '@/ui';
import { ProductPicker } from './ProductPicker';
import styles from './PromotionForm.module.css';

interface Props {
  /** `null` = alta; con promo = edición. */
  promotion: PromotionDefinition | null;
  catalog: readonly Product[];
  onSaved: (promotion: PromotionDefinition, mode: 'created' | 'updated') => void;
  onCancel: () => void;
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

/**
 * Alta y edición de promociones.
 *
 * El `kind` no se puede cambiar una vez creada: define qué estrategia corre y
 * qué forma tiene el `config`, así que cambiarlo dejaría la promo con
 * parámetros de otra cosa.
 */
export function PromotionForm({ promotion, catalog, onSaved, onCancel }: Props) {
  const isEditing = promotion !== null;
  const combo = asCombo(promotion?.config);
  const sameProduct = asSameProduct(promotion?.config);

  const [kind, setKind] = useState<PromotionKind>(promotion?.kind ?? 'combo');
  const [label, setLabel] = useState(promotion?.label ?? '');
  const [description, setDescription] = useState(promotion?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(promotion?.sortOrder ?? 10));

  // Combo
  const [pair, setPair] = useState<string[]>(combo ? [...combo.productIds] : []);
  const [bundleLarge, setBundleLarge] = useState(String(combo?.bundlePriceLarge ?? ''));
  const [bundleSmall, setBundleSmall] = useState(String(combo?.bundlePriceSmall ?? ''));

  // Mismo producto, distinto talle
  const [percentOff, setPercentOff] = useState(String(sameProduct?.percentOff ?? 10));
  const [scope, setScope] = useState<string[]>(sameProduct?.productIds ?? []);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const buildConfig = (): unknown =>
    kind === 'combo'
      ? {
          productIds: pair,
          bundlePriceLarge: Number(bundleLarge) || 0,
          bundlePriceSmall: Number(bundleSmall) || 0,
        }
      : { percentOff: Number(percentOff) || 0, productIds: scope };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (kind === 'combo' && pair.length !== 2) {
      setFormError('Un combo necesita exactamente dos productos.');
      return;
    }

    const parsed = promotionInputSchema.safeParse({
      kind,
      label,
      description,
      config: buildConfig(),
      isActive: promotion?.isActive ?? true,
      sortOrder: Number(sortOrder) || 0,
    });

    if (!parsed.success) {
      const errors = fieldErrorsFromZod(parsed.error);
      setFieldErrors(errors);
      setFormError(errors['_'] ?? 'Revisá los campos marcados.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = isEditing
        ? await promotionService.update(promotion.id, {
            label: parsed.data.label,
            description: parsed.data.description,
            sortOrder: parsed.data.sortOrder,
            config: parsed.data.config,
          })
        : await promotionService.create(parsed.data);
      onSaved(saved, isEditing ? 'updated' : 'created');
    } catch (caught) {
      setFieldErrors(fieldErrorsFromApi(caught));
      setFormError(errorMessage(caught, 'No se pudo guardar la promoción.'));
    } finally {
      setIsSaving(false);
    }
  }

  // Lo que se ahorra el socio, para que el club vea el número antes de guardar.
  const comboSavings = (() => {
    if (kind !== 'combo' || pair.length !== 2) return null;
    const items = pair.map((id) => catalog.find((product) => product.id === id));
    if (items.some((item) => !item)) return null;

    const large = items.reduce((sum, item) => sum + item!.priceLarge, 0);
    const small = items.reduce((sum, item) => sum + item!.priceSmall, 0);
    return {
      large: large - (Number(bundleLarge) || 0),
      small: small - (Number(bundleSmall) || 0),
      listLarge: large,
      listSmall: small,
    };
  })();

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <SelectField
        label="Tipo de promo *"
        value={kind}
        onChange={(event) => setKind(event.target.value as PromotionKind)}
        disabled={isEditing}
        hint={
          isEditing
            ? 'No se puede cambiar: cada tipo tiene su propia configuración.'
            : 'Define cómo se calcula el descuento.'
        }
      >
        {PROMOTION_KINDS.map((option) => (
          <option key={option} value={option}>
            {PROMOTION_KIND_LABELS[option]}
          </option>
        ))}
      </SelectField>

      <Field
        label="Nombre *"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        error={fieldErrors['label']}
        placeholder="Combo campera + pantalón"
        maxLength={80}
        hint="Es lo que ve el socio en el carrito y en el mail."
        required
      />

      <Field
        label="Descripción"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={fieldErrors['description']}
        placeholder="Llevando una campera y un pantalón juntos, pagás el precio del combo."
        maxLength={200}
      />

      {kind === 'combo' ? (
        <>
          <ProductPicker
            label="Los dos productos del combo *"
            hint="Se activa cuando el socio tiene uno de cada uno en el carrito."
            catalog={catalog}
            selected={pair}
            max={2}
            onChange={setPair}
          />

          <div className={styles.row}>
            <Field
              label="Precio del combo · talles grandes *"
              type="number"
              min={0}
              step={500}
              value={bundleLarge}
              onChange={(event) => setBundleLarge(event.target.value)}
              hint={
                comboSavings
                  ? `Sueltos: ${formatPrice(comboSavings.listLarge)} · ahorro ${formatPrice(comboSavings.large)}`
                  : 'Lo que paga el socio por los dos juntos.'
              }
              required
            />
            <Field
              label="Precio del combo · talles chicos *"
              type="number"
              min={0}
              step={500}
              value={bundleSmall}
              onChange={(event) => setBundleSmall(event.target.value)}
              hint={
                comboSavings
                  ? `Sueltos: ${formatPrice(comboSavings.listSmall)} · ahorro ${formatPrice(comboSavings.small)}`
                  : 'Sólo si las dos prendas son de talle chico.'
              }
              required
            />
          </div>

          {comboSavings && (comboSavings.large <= 0 || comboSavings.small <= 0) && (
            <Alert>
              Con esos precios el combo no ahorra nada, así que no se va a aplicar. Poné un precio
              menor a la suma de los dos sueltos.
            </Alert>
          )}
        </>
      ) : (
        <>
          <Field
            label="Descuento (%) *"
            type="number"
            min={1}
            max={90}
            value={percentOff}
            onChange={(event) => setPercentOff(event.target.value)}
            error={fieldErrors['config']}
            hint="Se aplica sobre la unidad más barata de cada par."
            required
          />

          <ProductPicker
            label="A qué productos aplica *"
            hint="Sólo estos. Un producto que no esté marcado nunca entra en la promo."
            catalog={catalog}
            selected={scope}
            onChange={setScope}
          />
        </>
      )}

      <Field
        label="Orden"
        type="number"
        min={0}
        step={10}
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
        hint="Menor número, se evalúa primero. Importa cuando dos promos compiten por la misma prenda."
      />

      <Alert>{formError}</Alert>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEditing ? 'Guardar cambios' : 'Crear promoción'}
        </Button>
      </div>
    </form>
  );
}
