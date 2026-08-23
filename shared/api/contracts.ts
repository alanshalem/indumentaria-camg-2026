export const API_BASE = '/api';

/**
 * Única fuente de verdad de las rutas. El router del servidor y el cliente HTTP
 * consumen esto, así una ruta nunca queda desalineada entre las dos puntas.
 */
export const ROUTES = {
  auth: {
    login: '/auth/login',
    session: '/auth/session',
  },
  products: {
    collection: '/products',
    byId: (id: string) => `/products/${encodeURIComponent(id)}`,
    pattern: '/products/:id',
  },
  promotions: {
    collection: '/promotions',
    byId: (id: string) => `/promotions/${encodeURIComponent(id)}`,
    pattern: '/promotions/:id',
  },
  orders: {
    collection: '/orders',
    byCode: (code: string) => `/orders/${encodeURIComponent(code)}`,
    pattern: '/orders/:code',
  },
  uploads: {
    productImage: '/uploads/product-image',
  },
} as const;

/**
 * Páginas públicas que se linkean desde afuera de la app (mails).
 * Viven acá para que el servidor arme la URL y el router del cliente la
 * matchee con la misma definición.
 */
export const PAGES = {
  orderStatusPattern: '/pedido/:code',
  orderStatus: (code: string, token: string) =>
    `/pedido/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`,
} as const;

export interface LoginResponse {
  token: string;
  /** Epoch ms de expiración; el cliente cierra sesión sin llamar al servidor. */
  expiresAt: number;
}

export interface SessionResponse {
  authenticated: boolean;
  expiresAt: number;
}

export interface UploadResponse {
  url: string;
}
