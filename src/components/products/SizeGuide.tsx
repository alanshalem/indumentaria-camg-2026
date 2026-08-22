import { SIZE_CHARTS, SIZE_CHART_IDS } from '@shared/domain/sizeCharts';
import { useSizeChartStore } from '@/store/sizeChartStore';
import { Modal } from '@/ui';
import styles from './SizeGuide.module.css';

export function SizeGuide() {
  const open = useSizeChartStore((state) => state.open);

  return (
    <section className={styles.section} id="talles">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Guía de talles</span>
          <h2 className={styles.title}>Encontrá tu talle</h2>
          <p className={styles.sub}>
            Medidas aproximadas en centímetros. Pueden variar 1 cm según la tela y el estampado.
          </p>
        </header>

        <div className={styles.grid}>
          {SIZE_CHART_IDS.map((id) => (
            <figure key={id} className={styles.card}>
              <button
                type="button"
                className={styles.imgBtn}
                onClick={() => open(id)}
                aria-label={`Ampliar tabla de talles de ${SIZE_CHARTS[id].label}`}
              >
                <img src={SIZE_CHARTS[id].imageUrl} alt={SIZE_CHARTS[id].alt} loading="lazy" />
              </button>
              <figcaption>{SIZE_CHARTS[id].label}</figcaption>
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
  const close = useSizeChartStore((state) => state.close);
  const chart = activeId ? SIZE_CHARTS[activeId] : null;

  return (
    <Modal bare isOpen={chart !== null} onClose={close} title={chart?.label ?? ''}>
      {chart && <img src={chart.imageUrl} alt={chart.alt} />}
    </Modal>
  );
}
