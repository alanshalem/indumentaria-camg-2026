/**
 * Rutas del cliente en un solo lugar. Una URL escrita a mano en un `<Link>` es
 * un enlace roto esperando a que alguien renombre la ruta.
 */
export const PATHS = {
  home: '/',
  catalog: '/#catalogo',
  login: '/login',
  admin: '/admin',
  product: '/producto/:id',
} as const;

export const productPath = (id: string): string => `/producto/${encodeURIComponent(id)}`;
