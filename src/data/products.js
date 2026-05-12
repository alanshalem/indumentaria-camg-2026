// Catálogo Club Atlético Monte Grande
// Precios en ARS. Imágenes servidas desde /public/images.

export const SIZES_NIÑOS_ADULTOS = [
  '8', '10', '12', '14', '16',
  'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
];

export const SIZES_ADULTOS = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const SIZES_MEDIAS = ['38-42', '42-50'];

export const products = [
  {
    id: 'campera-cierre-capucha',
    name: 'Campera con cierre y capucha',
    description: 'Original del club. Abrigada, con capucha y cierre completo.',
    image: '/images/buzo-algodon.jpg',
    sizes: SIZES_NIÑOS_ADULTOS,
    colors: ['Negro', 'Rojo'],
    price: 50000,
  },
  {
    id: 'campera-medio-cierre',
    name: 'Campera con medio cierre',
    description: 'Campera con medio cierre, ideal para entrenamiento.',
    image: '/images/campera-medio-cierre.jpeg',
    gallery: [
      '/images/campera-medio-cierre.jpeg',
      '/images/campera-medio-cierre-2.jpeg',
      '/images/campera-medio-cierre-3.jpeg',
      '/images/campera-medio-cierre-4.jpeg',
      '/images/campera-medio-cierre-5.jpeg',
    ],
    sizes: SIZES_NIÑOS_ADULTOS,
    colors: ['Negro', 'Rojo'],
    price: 40000,
  },
  {
    id: 'remera-algodon',
    name: 'Remera de algodón CAMG',
    description: 'Remera oficial 100% algodón con logo del club.',
    image: '/images/remera-algodon.jpg',
    sizes: SIZES_NIÑOS_ADULTOS,
    colors: ['Negro', 'Rojo', 'Blanco'],
    price: 25000,
  },
  {
    id: 'medias-3-4',
    name: 'Medias 3/4 deportivas',
    description: 'Medias 3/4, ideales para el deporte.',
    image: '/images/logo-club.png',
    sizes: SIZES_MEDIAS,
    colors: ['Negro', 'Rojo', 'Blanco'],
    price: 4000,
  },
  {
    id: 'pantalon-jogging',
    name: 'Pantalón Jogging',
    description: 'Pantalón jogging cómodo para entrenar.',
    image: '/images/talle-jogging.jpeg',
    sizes: SIZES_ADULTOS,
    colors: ['Negro'],
    price: 40000,
  },
  {
    id: 'musculosa-entrenamiento',
    name: 'Musculosa de entrenamiento',
    description: 'Musculosa liviana para entrenamiento.',
    image: '/images/musculosa-entrenamiento.jpeg',
    gallery: [
      '/images/musculosa-entrenamiento.jpeg',
      '/images/musculosa-2.jpeg',
    ],
    sizes: SIZES_ADULTOS,
    colors: ['Negro', 'Rojo'],
    price: 20000,
  },
  {
    id: 'indumentaria-juego',
    name: 'Indumentaria de juego (kit)',
    description: 'Kit completo: 2 musculosas + 2 pantalones.',
    image: '/images/musculosa-entrenamiento.jpeg',
    sizes: SIZES_ADULTOS,
    colors: ['Negro/Rojo'],
    price: 70000,
  },
];

export const PRODUCT_BY_ID = Object.fromEntries(products.map(p => [p.id, p]));
