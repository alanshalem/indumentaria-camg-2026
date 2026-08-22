import { useCallback, useState } from 'react';
import type { Product } from '@shared/domain/product';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { Alert, Button, Modal, Spinner } from '@/ui';
import { ProductForm } from './ProductForm';
import { ProductTable } from './ProductTable';
import styles from './ProductsPanel.module.css';

const NO_PRODUCTS: Product[] = [];

/** Qué diálogo está abierto. Un solo estado evita combinaciones imposibles. */
type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; product: Product | null }
  | { kind: 'confirmDelete'; product: Product };

const CLOSED: Dialog = { kind: 'none' };

export function ProductsPanel() {
  // includeInactive: el admin ve también lo despublicado; el catálogo público no.
  const loadProducts = useCallback(() => catalogService.list({ includeInactive: true }), []);
  const { data: products, error, isLoading, reload, set } = useAsyncResource(loadProducts, NO_PRODUCTS);

  const [dialog, setDialog] = useState<Dialog>(CLOSED);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const upsert = (saved: Product) =>
    set((current) => {
      const exists = current.some((item) => item.id === saved.id);
      const next = exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
      return [...next].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    });

  async function runAction(product: Product, action: () => Promise<void>, message: string) {
    setActionError('');
    setNotice('');
    setBusyId(product.id);
    try {
      await action();
      setNotice(message);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  const toggleActive = (product: Product) =>
    runAction(
      product,
      async () => upsert(await catalogService.update(product.id, { isActive: !product.isActive })),
      product.isActive ? `"${product.name}" ya no se muestra en el catálogo.` : `"${product.name}" está publicado.`,
    );

  const confirmDelete = (product: Product) =>
    runAction(
      product,
      async () => {
        await catalogService.remove(product.id);
        set((current) => current.filter((item) => item.id !== product.id));
        setDialog(CLOSED);
      },
      `"${product.name}" se eliminó del catálogo.`,
    );

  return (
    <>
      <section className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Catálogo</h2>
          <p className={styles.sub}>
            {products.length} producto{products.length === 1 ? '' : 's'} ·{' '}
            {products.filter((product) => product.isActive).length} visible(s)
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="ghost" onClick={() => void reload()}>
            Actualizar
          </Button>
          <Button onClick={() => setDialog({ kind: 'form', product: null })}>+ Nuevo producto</Button>
        </div>
      </section>

      {notice && <Alert tone="success">{notice}</Alert>}
      {(error || actionError) && <Alert>{actionError || error}</Alert>}

      {isLoading && products.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size={26} label="Cargando catálogo…" />
        </div>
      ) : (
        <ProductTable
          products={products}
          busyId={busyId}
          onEdit={(product) => setDialog({ kind: 'form', product })}
          onToggleActive={(product) => void toggleActive(product)}
          onDelete={(product) => setDialog({ kind: 'confirmDelete', product })}
        />
      )}

      <Modal
        size="lg"
        isOpen={dialog.kind === 'form'}
        onClose={() => setDialog(CLOSED)}
        title={dialog.kind === 'form' && dialog.product ? 'Editar producto' : 'Nuevo producto'}
      >
        {dialog.kind === 'form' && (
          <ProductForm
            product={dialog.product}
            onCancel={() => setDialog(CLOSED)}
            onSaved={(saved, mode) => {
              upsert(saved);
              setDialog(CLOSED);
              setActionError('');
              setNotice(mode === 'created' ? `"${saved.name}" se creó.` : `"${saved.name}" se actualizó.`);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={dialog.kind === 'confirmDelete'}
        onClose={() => setDialog(CLOSED)}
        title="Eliminar producto"
      >
        {dialog.kind === 'confirmDelete' && (
          <div className={styles.confirm}>
            <p>
              ¿Eliminar <strong>{dialog.product.name}</strong> del catálogo? La acción no se puede deshacer.
            </p>
            <p className={styles.confirmHint}>
              Los pedidos ya generados no se tocan: guardan su propia copia del nombre y del precio.
              Si sólo querés sacarlo de la vista, usá <strong>Oculto</strong>.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setDialog(CLOSED)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                loading={busyId === dialog.product.id}
                onClick={() => void confirmDelete(dialog.product)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
