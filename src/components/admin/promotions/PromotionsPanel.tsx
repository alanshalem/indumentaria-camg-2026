import { useCallback, useState } from 'react';
import type { PromotionDefinition } from '@shared/domain/promotions';
import { PROMOTION_KIND_LABELS } from '@shared/domain/promotions';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { errorMessage } from '@/services/apiError';
import { promotionService } from '@/services/promotionService';
import { Alert, Button, Spinner } from '@/ui';
import { PromotionCard } from './PromotionCard';
import styles from './PromotionsPanel.module.css';

const NO_PROMOTIONS: PromotionDefinition[] = [];

/**
 * Las promociones son de código (cada `kind` es una estrategia tipada y
 * testeada) pero sus parámetros viven en la base. El club cambia montos o apaga
 * una promo desde acá, sin tocar el repositorio ni esperar un deploy.
 */
export function PromotionsPanel() {
  const load = useCallback(() => promotionService.list({ includeInactive: true }), []);
  const { data: promotions, error, isLoading, reload, set } = useAsyncResource(load, NO_PROMOTIONS);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const save = useCallback(
    async (id: string, patch: Parameters<typeof promotionService.update>[1], message: string) => {
      setActionError('');
      setNotice('');
      setBusyId(id);
      try {
        const saved = await promotionService.update(id, patch);
        set((current) => current.map((promotion) => (promotion.id === id ? saved : promotion)));
        setNotice(message);
      } catch (caught) {
        setActionError(errorMessage(caught));
      } finally {
        setBusyId(null);
      }
    },
    [set],
  );

  return (
    <>
      <section className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Promociones</h2>
          <p className={styles.sub}>
            {promotions.filter((promotion) => promotion.isActive).length} de {promotions.length}{' '}
            activas · se aplican solas cuando el socio arma el carrito
          </p>
        </div>
        <Button variant="ghost" onClick={() => void reload()}>
          Actualizar
        </Button>
      </section>

      {notice && <Alert tone="success">{notice}</Alert>}
      {(error || actionError) && <Alert>{actionError || error}</Alert>}

      {isLoading && promotions.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size={26} label="Cargando promociones…" />
        </div>
      ) : (
        <div className={styles.list}>
          {promotions.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              kindLabel={PROMOTION_KIND_LABELS[promotion.kind] ?? promotion.kind}
              isBusy={busyId === promotion.id}
              onToggle={() =>
                void save(
                  promotion.id,
                  { isActive: !promotion.isActive },
                  promotion.isActive
                    ? `"${promotion.label}" quedó desactivada.`
                    : `"${promotion.label}" está activa.`,
                )
              }
              onSaveConfig={(config) =>
                void save(promotion.id, { config }, `"${promotion.label}" se actualizó.`)
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
