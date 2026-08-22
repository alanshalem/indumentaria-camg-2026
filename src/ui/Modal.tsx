import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Oculta el marco: para lightbox de imágenes a pantalla completa. */
  bare?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible: bloquea el scroll, cierra con Escape o click en el fondo,
 * atrapa el foco y lo devuelve al elemento que lo abrió. La app tenía tres
 * capas modales distintas y ninguna hacía todo esto.
 */
export function Modal({ isOpen, onClose, title, bare = false, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => restoreFocusRef.current?.focus();
  }, [isOpen]);

  const trapFocus = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={bare ? styles.bare : styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        {!bare && (
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </header>
        )}
        {bare && (
          <button type="button" className={styles.closeFloating} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        )}
        <div className={bare ? styles.bareBody : styles.body}>{children}</div>
      </div>
    </div>
  );
}
