import { useCallback, useState } from 'react';
import type { Product } from '@shared/domain/product';
import type { PromotionDefinition } from '@shared/domain/promotions';
import { PROMOTION_KIND_LABELS } from '@shared/domain/promotions';
import { useAdminAction } from '@/hooks/useAdminAction';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { catalogService } from '@/services/catalogService';
import { promotionService } from '@/services/promotionService';
import { Alert, Button, EmptyState, Spinner } from '@/ui';
import { PromotionCard } from './PromotionCard';
import { PromotionForm } from './PromotionForm';
import styles from './PromotionsPanel.module.css';

const NO_PROMOTIONS: PromotionDefinition[] = [];
const NO_PRODUCTS: Product[] = [];

/** `null` = nada abierto; `'new'` = alta; un id = edición de esa promo. */
type Editing = string | 'new' | null;

/**
 * Las promociones son de código —cada `kind` es una estrategia tipada y
 * testeada— pero el club las arma, prende y apaga desde acá. Agregar una promo
 * nueva del mismo tipo no necesita un deploy; agregar un tipo nuevo sí.
 */
export function PromotionsPanel() {
  const loadPromotions = useCallback(() => promotionService.list({ includeInactive: true }), []);
  const { data: promotions, error, isLoading, reload, set } = useAsyncResource(
    loadPromotions,
    NO_PROMOTIONS,
  );

  // El catálogo es para elegir a qué productos aplica cada promo.
  const loadCatalog = useCallback(() => catalogService.list({ includeInactive: true }), []);
  const { data: catalog } = useAsyncResource(loadCatalog, NO_PRODUCTS);

  const { busyId, notice, error: actionError, run, notify, setError } = useAdminAction();
  const [editing, setEditing] = useState<Editing>(null);

  const save = useCallback(
    (id: string, patch: Parameters<typeof promotionService.update>[1], message: string) =>
      run(
        id,
        async () => {
          const saved = await promotionService.update(id, patch);
          set((current) => current.map((promotion) => (promotion.id === id ? saved : promotion)));
        },
        message,
      ),
    [run, set],
  );

  const remove = useCallback(
    (promotion: PromotionDefinition) =>
      run(
        promotion.id,
        async () => {
          await promotionService.remove(promotion.id);
          set((current) => current.filter((item) => item.id !== promotion.id));
        },
        `"${promotion.label}" se eliminó.`,
      ),
    [run, set],
  );

  function handleSaved(saved: PromotionDefinition, mode: 'created' | 'updated') {
    set((current) =>
      mode === 'created'
        ? [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder)
        : current.map((promotion) => (promotion.id === saved.id ? saved : promotion)),
    );
    setEditing(null);
    setError('');
    notify(mode === 'created' ? `"${saved.label}" quedó creada.` : `"${saved.label}" se actualizó.`);
  }

  const active = promotions.filter((promotion) => promotion.isActive).length;

  return (
    <>
      <section className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Promociones</h2>
          <p className={styles.sub}>
            {active} de {promotions.length} activas · se aplican solas cuando el socio arma el
            carrito
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="ghost" onClick={() => void reload()}>
            Actualizar
          </Button>
          <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
            Nueva promoción
          </Button>
        </div>
      </section>

      {notice && <Alert tone="success">{notice}</Alert>}
      {(error || actionError) && <Alert>{actionError || error}</Alert>}

      {editing === 'new' && (
        <PromotionForm
          promotion={null}
          catalog={catalog}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {isLoading && promotions.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size={26} label="Cargando promociones…" />
        </div>
      ) : promotions.length === 0 && editing !== 'new' ? (
        <EmptyState title="Todavía no hay promociones.">
          <Button onClick={() => setEditing('new')}>Crear la primera</Button>
        </EmptyState>
      ) : (
        <div className={styles.list}>
          {promotions.map((promotion) =>
            editing === promotion.id ? (
              <PromotionForm
                key={promotion.id}
                promotion={promotion}
                catalog={catalog}
                onSaved={handleSaved}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <PromotionCard
                key={promotion.id}
                promotion={promotion}
                catalog={catalog}
                kindLabel={PROMOTION_KIND_LABELS[promotion.kind] ?? promotion.kind}
                isBusy={busyId === promotion.id}
                onEdit={() => setEditing(promotion.id)}
                onDelete={() => void remove(promotion)}
                onToggle={() =>
                  void save(
                    promotion.id,
                    { isActive: !promotion.isActive },
                    promotion.isActive
                      ? `"${promotion.label}" quedó desactivada.`
                      : `"${promotion.label}" está activa.`,
                  )
                }
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
