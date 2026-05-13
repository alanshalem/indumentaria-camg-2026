// Catálogo Club Atlético Monte Grande — fuente: productos.txt
// Precios en ARS.

export const SIZES_8_XXXL = ['8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const SIZES_ADULTOS = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const SIZES_MEDIAS = ['38-42', '42-50'];

export const products = [
  {
    id: 'campera-cierre-capucha',
    name: 'Campera con cierre y capucha',
    description: 'Original del club. Cierre completo y capucha.',
    image: '/images/campera-cierre-completo.png',
    sizes: SIZES_8_XXXL,
    price: 50000,
  },
  {
    id: 'campera-medio-cierre',
    name: 'Campera con medio cierre',
    description: 'Campera con medio cierre, ideal para entrenamiento.',
    image: '/images/campera-medio-cierre.png',
    sizes: SIZES_8_XXXL,
    price: 40000,
  },
  {
    id: 'remera-algodon',
    name: 'Remera de algodón CAMG',
    description: 'Remera oficial 100% algodón con escudo del club.',
    image: '/images/sudadera.png',
    sizes: SIZES_8_XXXL,
    price: 25000,
  },
  {
    id: 'medias-3-4',
    name: 'Medias 3/4 deportivas',
    description: 'Medias 3/4, ideales para el deporte.',
    image: '/images/medias.jpg',
    sizes: SIZES_MEDIAS,
    price: 4000,
  },
  {
    id: 'pantalon-jogging',
    name: 'Pantalón Jogging',
    description: 'Pantalón jogging cómodo para entrenar.',
    image: '/images/jogging.png',
    sizes: SIZES_ADULTOS,
    price: 40000,
  },
  {
    id: 'musculosa-entrenamiento',
    name: 'Musculosa de entrenamiento',
    description: 'Musculosa liviana para entrenamiento.',
    image: '/images/musculosa-de-entrenamiento.png',
    sizes: SIZES_ADULTOS,
    price: 20000,
  },
];

export const PRODUCT_BY_ID = Object.fromEntries(products.map(p => [p.id, p]));
