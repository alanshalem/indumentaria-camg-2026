import styles from './SizeGuide.module.css';

export default function SizeGuide() {
  return (
    <section className={styles.section} id="talles">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Guía de talles</span>
          <h2 className={styles.title}>Encontrá tu talle</h2>
          <p className={styles.sub}>Consultá las medidas antes de elegir.</p>
        </header>

        <div className={styles.grid}>
          <figure className={styles.card}>
            <img src="/images/talle-jogging.jpeg" alt="Guía de talles - Joggings" loading="lazy" />
            <figcaption>Joggings</figcaption>
          </figure>
          <figure className={styles.card}>
            <img src="/images/talles-buzos-y-camperas.jpeg" alt="Guía de talles - Buzos y camperas" loading="lazy" />
            <figcaption>Buzos y camperas</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
