import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface BaseProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

type InputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;
type SelectProps = BaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

/**
 * Campo de formulario con label asociado, error y `aria-invalid`.
 * Los seis formularios de la app repetían este bloque a mano; varios se
 * olvidaban del `htmlFor`, dejando el label sin vincular al input.
 */
export function Field({ label, error, hint, ...input }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField({ label, error, hint, children, ...select }: SelectProps) {
  const id = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select {...select} id={id} aria-invalid={error ? true : undefined}>
        {children}
      </select>
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

/** Contenedor para controles que no son un input nativo (chips, uploader…). */
export function FieldShell({ label, error, hint, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.pseudoLabel}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
