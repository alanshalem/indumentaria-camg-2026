import { useRef, useState } from 'react';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import { Spinner } from '@/ui';
import styles from './ImagePicker.module.css';

interface Props {
  value: string;
  /** `compact` es la versión chica que va dentro de cada fila de color. */
  variant?: 'full' | 'compact';
  onChange: (url: string) => void;
  onError?: (message: string) => void;
}

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/avif';

/**
 * Subir un archivo o pegar una ruta, con vista previa.
 *
 * La miniatura ES el botón: hacer click en la foto abre el selector de
 * archivos. Antes había un botón "Subir archivo" a todo el ancho que parecía
 * un encabezado de sección y no un control, y la ruta quedaba cortada en un
 * input diminuto.
 */
export function ImagePicker({ value, variant = 'full', onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      onChange(await catalogService.uploadImage(file));
    } catch (caught) {
      onError?.(errorMessage(caught, 'No se pudo subir la imagen.'));
    } finally {
      setIsUploading(false);
      // Permite volver a elegir el mismo archivo después de un error.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div className={`${styles.picker} ${variant === 'compact' ? styles.compact : ''}`}>
      <button
        type="button"
        className={styles.preview}
        onClick={openFilePicker}
        disabled={isUploading}
        aria-label={value ? 'Cambiar la imagen' : 'Subir una imagen'}
      >
        {isUploading ? (
          <Spinner size={18} />
        ) : value ? (
          <>
            <img src={value} alt="" />
            <span className={styles.overlay}>Cambiar</span>
          </>
        ) : (
          <span className={styles.empty}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Subir
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className={styles.fileInput}
        disabled={isUploading}
        onChange={(event) => void handleFile(event.target.files?.[0])}
        tabIndex={-1}
      />

      <div className={styles.controls}>
        {variant === 'full' && (
          <p className={styles.hint}>
            Hacé click en la foto para subir una. JPG, PNG o WebP, hasta 4 MB.
          </p>
        )}
        <label className={styles.urlField}>
          <span>Ruta o URL</span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="/images/fotos-prendas/remera.jpg"
            spellCheck={false}
          />
        </label>
      </div>
    </div>
  );
}
