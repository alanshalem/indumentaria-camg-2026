import { useState } from 'react';
import { errorMessage } from '@/services/apiError';
import { catalogService } from '@/services/catalogService';
import styles from './ProductForm.module.css';

interface Props {
  value: string;
  placeholder?: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
}

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/avif';

/**
 * Subir archivo o pegar una URL, con vista previa. Es el mismo control para la
 * foto principal y para cada variante de color, así el admin no aprende dos
 * formas distintas de cargar una imagen.
 */
export function ImagePicker({ value, placeholder = '/images/… o https://…', onChange, onError }: Props) {
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
    }
  }

  return (
    <div className={styles.imagePicker}>
      <div className={styles.preview}>
        {value ? <img src={value} alt="" /> : <span className={styles.previewEmpty}>Sin imagen</span>}
      </div>
      <div className={styles.imageControls}>
        <label className={styles.uploadBtn}>
          {isUploading ? 'Subiendo…' : 'Subir archivo'}
          <input
            type="file"
            accept={ACCEPTED}
            disabled={isUploading}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label="URL de la imagen"
        />
      </div>
    </div>
  );
}
