import { webpSrcSet } from '@shared/media/imageVariants';

interface Props {
  src: string;
  alt: string;
  /**
   * Cuánto va a ocupar en pantalla, para que el navegador elija el ancho antes
   * de saber el layout. Sin esto siempre baja el más grande del `srcset`.
   */
  sizes: string;
  className?: string;
  /** La foto principal de la ficha se ve al abrir: no debe cargar diferida. */
  eager?: boolean;
}

/**
 * Imagen con derivados WebP.
 *
 * El `src` sigue siendo la ruta original —la que guarda la base y la que edita
 * el admin—; los WebP salen del manifiesto que genera `npm run images`. Si esa
 * imagen no tiene derivados (por ejemplo, una que subió el admin a Supabase),
 * se degrada a un `<img>` común sin que haya que decidir nada en el llamador.
 */
export function Picture({ src, alt, sizes, className, eager = false }: Props) {
  const srcSet = webpSrcSet(src);

  // La clase va siempre en el <img>, nunca en el <picture>: el CSS existente
  // dimensiona la imagen y el wrapper es `display: contents`, así que no
  // aparece en el layout. Cambiar de <img> a <picture> no mueve nada.
  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );

  if (!srcSet) return img;

  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      {img}
    </picture>
  );
}
