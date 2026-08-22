import styles from './Spinner.module.css';

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span className={styles.wrap} role={label ? 'status' : undefined}>
      <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
