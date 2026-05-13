import { useEffect, useState } from 'react';
import styles from './SizeGuide.module.css';

const GUIDES = [
  { src: '/images/talle-jogging.jpeg', label: 'Joggings', alt: 'Guía de talles - Joggings' },
  { src: '/images/talles-buzos-y-camperas.jpeg', label: 'Buzos y camperas', alt: 'Guía de talles - Buzos y camperas' },
];

export default function SizeGuide() {
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <section className={styles.section} id="talles">
      <div className="container">
        <header className={styles.head}>
          <span className={styles.eyebrow}>Guía de talles</span>
          <h2 className={styles.title}>Encontrá tu talle</h2>
          <p className={styles.sub}>Consultá las medidas antes de elegir.</p>
        </header>

        <div className={styles.grid}>
          {GUIDES.map((g) => (
            <figure key={g.src} className={styles.card}>
              <button
                type="button"
                className={styles.imgBtn}
                onClick={() => setActive(g)}
                aria-label={`Ampliar ${g.label}`}
              >
                <img src={g.src} alt={g.alt} loading="lazy" />
              </button>
              <figcaption>{g.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      {active && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className={styles.close}
            onClick={() => setActive(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
          <img
            src={active.src}
            alt={active.alt}
            className={styles.overlayImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
