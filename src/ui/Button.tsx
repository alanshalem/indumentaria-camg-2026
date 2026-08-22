import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  /** Muestra spinner y bloquea el click: evita el doble submit. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

/**
 * Único punto donde se decide cómo se ve y se comporta un botón.
 * Antes cada pantalla repetía `className="btn btn-primary btn-block"` y el
 * estado de "enviando" se manejaba a mano en cada formulario.
 */
export function Button({
  variant = 'primary',
  block = false,
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', VARIANT_CLASS[variant], block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading}>
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
