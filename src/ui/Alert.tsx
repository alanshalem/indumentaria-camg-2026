import type { ReactNode } from 'react';
import styles from './Alert.module.css';

type Tone = 'error' | 'success' | 'info';

const ROLE_BY_TONE: Record<Tone, 'alert' | 'status'> = {
  error: 'alert',
  success: 'status',
  info: 'status',
};

/** Mensajes de estado con el rol ARIA correcto según su severidad. */
export function Alert({ tone = 'error', children }: { tone?: Tone; children: ReactNode }) {
  if (!children) return null;
  return (
    <p className={`${styles.alert} ${styles[tone]}`} role={ROLE_BY_TONE[tone]}>
      {children}
    </p>
  );
}
