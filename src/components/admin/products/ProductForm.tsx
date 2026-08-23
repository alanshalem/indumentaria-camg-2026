import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatPrice } from '@shared/domain/money.js';
import {
  resolveProductId,
  type Product,
  type ProductColor,
  type ProductInput,
} from '@shared/domain/product.js';
import { SIZE_CHARTS, SIZE_CHART_IDS, type SizeChartId } from '@shared/domain/sizeCharts.js';
import { productInputSchema } from '@shared/schemas/product.schema.js';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { fieldErrorsFromApi, fieldErrorsFromZod } from '@/utils/formErrors';
import { Alert, Button, Field, SelectField } from '@/ui';
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

/** Bloque con título: el formulario es largo y sin secciones no se ubica nada. */
function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>{title}</legend>
      {help && <p className={styles.help}>{help}</p>}
      <div className={styles.sectionBody}>{children}</div>
    </fieldset>
  );
}

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
      const errors = fieldErrorsFromZod(parsed.error);
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
      setFieldErrors(fieldErrorsFromApi(caught));
      setFormError(errorMessage(caught, 'No se pudo guardar el producto.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Section title="Datos del producto">
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
          label="Descripción"
          value={form.description}
          onChange={(event) => patch('description', event.target.value)}
          error={fieldErrors['description']}
          placeholder="Campera con capucha y cierre completo."
          maxLength={300}
          hint="Se muestra debajo del nombre en el catálogo."
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
              : 'Se genera solo a partir del nombre. Se usa en la URL, en los pedidos y en las promos.'
          }
        />
      </Section>

      <Section
        title="Precios y talles"
        help={
          <>
            El precio depende del talle. Cargá los talles chicos (los numéricos, 6 a 14) y los
            grandes (XS a 3XL) por separado: cada grupo cobra su propio precio.{' '}
            <strong>Un talle no puede estar en los dos grupos.</strong>
          </>
        }
      >
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
          hint="Se muestra como link en la ficha del producto y en la sección Guía de talles."
        >
          <option value="">Sin tabla</option>
          {SIZE_CHART_IDS.map((id) => (
            <option key={id} value={id}>
              {SIZE_CHARTS[id].label}
            </option>
          ))}
        </SelectField>
      </Section>

      <Section
        title="Fotos y colores"
        help="La foto principal es la que se ve en el catálogo. Si el producto viene en varios colores, cargá uno por color con su propia foto."
      >
        <div className={styles.block}>
          <span className={styles.blockLabel}>Foto principal *</span>
          <ImagePicker
            value={form.imageUrl}
            onChange={(url) => patch('imageUrl', url)}
            onError={setFormError}
          />
          {fieldErrors['imageUrl'] && (
            <span className={styles.blockError}>{fieldErrors['imageUrl']}</span>
          )}
        </div>

        <div className={styles.block}>
          <span className={styles.blockLabel}>
            Colores {form.colors.length > 0 && <em>({form.colors.length})</em>}
          </span>
          <ColorEditor
            colors={form.colors}
            error={fieldErrors['colors']}
            onChange={(colors) => patch('colors', colors)}
            onError={setFormError}
          />
        </div>
      </Section>

      <Section title="Publicación">
        <div className={styles.row}>
          <Field
            label="Orden en el catálogo"
            type="number"
            min={0}
            step={10}
            value={form.sortOrder}
            onChange={(event) => patch('sortOrder', event.target.value)}
            error={fieldErrors['sortOrder']}
            hint="Menor número, más arriba."
          />
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => patch('isActive', event.target.checked)}
            />
            <span>
              <strong>Visible en el catálogo público</strong>
              <em>Destildado queda oculto para los socios, pero sigue en el panel.</em>
            </span>
          </label>
        </div>
      </Section>

      {/* Barra fija: el formulario es largo y guardar no puede depender de
          llegar scrolleando hasta el fondo. */}
      <div className={styles.actions}>
        <Alert>{formError}</Alert>
        <div className={styles.actionButtons}>
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEditing ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </div>
    </form>
  );
}
