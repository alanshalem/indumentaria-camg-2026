import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <img src="/images/logo-club.png" alt="" className={styles.logo} />
          <div>
            <p className={styles.title}>Club Atlético Monte Grande</p>
            <p className={styles.sub}>Indumentaria oficial · Temporada 2026</p>
          </div>
        </div>

        <div className={styles.social}>
          <a
            href="https://instagram.com/clubatleticomontegrande"
            target="_blank"
            rel="noreferrer"
            className={styles.socialLink}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
            </svg>
            @clubatleticomontegrande
          </a>
        </div>
      </div>
      <p className={styles.copy}>© {new Date().getFullYear()} CAMG. Todos los derechos reservados.</p>
    </footer>
  );
}
