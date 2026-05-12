import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.text}>
          <span className={styles.eyebrow}>Temporada 2026</span>
          <h1 className={styles.title}>
            Indumentaria oficial<br />
            <span className={styles.accent}>Club Atlético Monte Grande</span>
          </h1>
          <p className={styles.sub}>
            Llevá los colores del club. Pedidos online para socios, retiro en sede.
          </p>
          <a href="#catalogo" className="btn btn-primary">Ver catálogo</a>
        </div>
        <div className={styles.logoWrap}>
          <img src="/images/logo-club.png" alt="" className={styles.logo} />
        </div>
      </div>
    </section>
  );
}
