import { SIZE_CHARTS, SIZE_CHART_IDS, SIZE_CHART_NOTE } from '@shared/domain/sizeCharts';
import { useSizeChartStore } from '@/store/sizeChartStore';
import { Modal } from '@/ui';
import { Picture } from '@/ui/Picture';
import { SizeChartTable } from './SizeChartTable';
import styles from './SizeGuide.module.css';

export function SizeGuide() {
  const open = useSizeChartStore((state) => state.open);

  return (
    <section className={styles.section} id="talles">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Guía de talles</span>
          <h2 className={styles.title}>Encontrá tu talle</h2>
          <p className={styles.sub}>{SIZE_CHART_NOTE}</p>
        </header>

        <div className={styles.grid}>
          {SIZE_CHART_IDS.map((id) => (
            <figure key={id} className={styles.card}>
              <figcaption className={styles.cardTitle}>{SIZE_CHARTS[id].label}</figcaption>
              {/* La tabla primero: es lo que el socio necesita leer. El dibujo
                  queda atrás como referencia de dónde se toma cada medida. */}
              <SizeChartTable chart={SIZE_CHARTS[id]} />
              <button type="button" className={styles.imgBtn} onClick={() => open(id)}>
                Ver dónde se mide
              </button>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Visor a pantalla completa. Se monta una sola vez en la página: lo abren tanto
 * esta sección como el link "Ver tabla de talles" de cada ficha de producto.
 */
export function SizeChartViewer() {
  const activeId = useSizeChartStore((state) => state.activeId);
  const highlight = useSizeChartStore((state) => state.highlight);
  const close = useSizeChartStore((state) => state.close);
  const chart = activeId ? SIZE_CHARTS[activeId] : null;

  return (
    <Modal bare isOpen={chart !== null} onClose={close} title={chart?.label ?? ''}>
      {chart && (
        <div className={styles.viewer}>
          <Picture
            src={chart.imageUrl}
            alt={chart.alt}
            sizes="(max-width: 900px) 92vw, 860px"
            eager
          />
          <SizeChartTable chart={chart} highlight={highlight ?? undefined} />
          <p className={styles.viewerNote}>{SIZE_CHART_NOTE}</p>
        </div>
      )}
    </Modal>
  );
}
