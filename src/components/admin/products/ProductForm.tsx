import { useMemo, useState, type FormEvent } from 'react';
import { formatPrice } from '@shared/domain/money';
import {
  resolveProductId,
  type Product,
  type ProductColor,
  type ProductInput,
} from '@shared/domain/product';
import { SIZE_CHARTS, SIZE_CHART_IDS, type SizeChartId } from '@shared/domain/sizeCharts';
import { productInputSchema } from '@shared/schemas/product.schema';
import { ApiError, errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { Alert, Button, Field, FieldShell, SelectField } from '@/ui';
import { ColorEditor } from './ColorEditor';
import { ImagePicker } from './ImagePicker';
import { SizeTierEditor } from './SizeTierEditor';
import styles from './ProductForm.module.css';

interface Props {
  /** `null` = alta; con producto = edición. */
  product: Product | null;
  onSaved: (product: Product, mode: 'created' | 'updated') => void;
  onCancel: () => void;
}

interface FormState {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  sizesSmall: string[];
  sizesLarge: string[];
  priceSmall: string;
  priceLarge: string;
  colors: ProductColor[];
  sizeChartId: SizeChartId | '';
  isActive: boolean;
  sortOrder: string;
}

const emptyForm = (): FormState => ({
  id: '',
  name: '',
  description: '',
  imageUrl: '',
  sizesSmall: [],
  sizesLarge: [],
  priceSmall: '',
  priceLarge: '',
  colors: [],
  sizeChartId: '',
  isActive: true,
  sortOrder: '0',
});

const toForm = (product: Product): FormState => ({
  id: product.id,
  name: product.name,
  description: product.description,
  imageUrl: product.imageUrl,
  sizesSmall: [...product.sizesSmall],
  sizesLarge: [...product.sizesLarge],
  priceSmall: String(product.priceSmall),
  priceLarge: String(product.priceLarge),
  colors: product.colors.map((color) => ({ ...color })),
  sizeChartId: product.sizeChartId ?? '',
  isActive: product.isActive,
  sortOrder: String(product.sortOrder),
});

/**
 * Alta y edición comparten formulario: los campos, las validaciones y el
 * uploader son idénticos, sólo cambia a qué endpoint se envía.
 */
export function ProductForm({ product, onSaved, onCancel }: Props) {
  const isEditing = product !== null;
  const [form, setForm] = useState<FormState>(() => (product ? toForm(product) : emptyForm()));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Al crear, el identificador se deriva del nombre y se puede ajustar a mano.
  const previewId = useMemo(
    () => (isEditing ? form.id : resolveProductId({ id: form.id, name: form.name })),
    [isEditing, form.id, form.name],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    const candidate = {
      ...(isEditing ? {} : { id: previewId || undefined }),
      name: form.name,
      description: form.description,
      imageUrl: form.imageUrl,
      sizesSmall: form.sizesSmall,
      sizesLarge: form.sizesLarge,
      priceSmall: Number(form.priceSmall),
      priceLarge: Number(form.priceLarge),
      colors: form.colors,
      sizeChartId: form.sizeChartId || null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };

    const parsed = productInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.map(String).join('.') || '_'] ??= issue.message;
      }
      setFieldErrors(errors);
      setFormError(errors['_'] ?? 'Revisá los campos marcados.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = isEditing
        ? await catalogService.update(product.id, parsed.data as Partial<ProductInput>)
        : await catalogService.create(parsed.data);
      onSaved(saved, isEditing ? 'updated' : 'created');
    } catch (caught) {
      if (caught instanceof ApiError) setFieldErrors(caught.fields);
      setFormError(errorMessage(caught, 'No se pudo guardar el producto.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Field
        label="Nombre *"
        value={form.name}
        onChange={(event) => patch('name', event.target.value)}
        error={fieldErrors['name']}
        placeholder="Campera Canguro CAMG"
        maxLength={80}
        required
      />

      <Field
        label="Identificador"
        value={previewId}
        onChange={(event) => patch('id', event.target.value)}
        error={fieldErrors['id']}
        disabled={isEditing}
        hint={
          isEditing
            ? 'No se puede cambiar: los pedidos históricos y las promos lo referencian.'
            : 'Se genera solo a partir del nombre. Se usa en los pedidos y en las promos.'
        }
      />

      <Field
        label="Descripción"
        value={form.description}
        onChange={(event) => patch('description', event.target.value)}
        error={fieldErrors['description']}
        placeholder="Campera con capucha y cierre completo."
        maxLength={300}
      />

      <div className={styles.row}>
        <Field
          label="Precio talles chicos *"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={form.priceSmall}
          onChange={(event) => patch('priceSmall', event.target.value)}
          error={fieldErrors['priceSmall']}
          hint={Number(form.priceSmall) > 0 ? formatPrice(Number(form.priceSmall)) : 'Sin centavos.'}
          required
        />
        <Field
          label="Precio talles grandes *"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={form.priceLarge}
          onChange={(event) => patch('priceLarge', event.target.value)}
          error={fieldErrors['priceLarge']}
          hint={Number(form.priceLarge) > 0 ? formatPrice(Number(form.priceLarge)) : 'Sin centavos.'}
          required
        />
      </div>

      <SizeTierEditor
        tier="small"
        label="Talles chicos"
        price={Number(form.priceSmall) || 0}
        sizes={form.sizesSmall}
        taken={form.sizesLarge}
        error={fieldErrors['sizesSmall']}
        onChange={(sizes) => patch('sizesSmall', sizes)}
      />

      <SizeTierEditor
        tier="large"
        label="Talles grandes"
        price={Number(form.priceLarge) || 0}
        sizes={form.sizesLarge}
        taken={form.sizesSmall}
        error={fieldErrors['sizesLarge']}
        onChange={(sizes) => patch('sizesLarge', sizes)}
      />

      <SelectField
        label="Tabla de talles"
        value={form.sizeChartId}
        onChange={(event) => patch('sizeChartId', event.target.value as SizeChartId | '')}
        hint="Se muestra como link en la ficha del producto."
      >
        <option value="">Sin tabla</option>
        {SIZE_CHART_IDS.map((id) => (
          <option key={id} value={id}>
            {SIZE_CHARTS[id].label}
          </option>
        ))}
      </SelectField>

      <FieldShell label="Foto principal *" error={fieldErrors['imageUrl']}>
        <ImagePicker
          value={form.imageUrl}
          onChange={(url) => patch('imageUrl', url)}
          onError={setFormError}
        />
      </FieldShell>

      <ColorEditor
        colors={form.colors}
        error={fieldErrors['colors']}
        onChange={(colors) => patch('colors', colors)}
      />

      <div className={styles.row}>
        <Field
          label="Orden"
          type="number"
          min={0}
          step={10}
          value={form.sortOrder}
          onChange={(event) => patch('sortOrder', event.target.value)}
          error={fieldErrors['sortOrder']}
          hint="Menor número, más arriba en el catálogo."
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => patch('isActive', event.target.checked)}
          />
          <span>Visible en el catálogo público</span>
        </label>
      </div>

      <Alert>{formError}</Alert>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEditing ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
