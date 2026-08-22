import type { Order } from '../domain/order';
import type { Product } from '../domain/product';
import type { PromotionDefinition } from '../domain/promotions';

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

export type ProductListResponse = Product[];
export type ProductResponse = Product;
export type PromotionListResponse = PromotionDefinition[];
export type PromotionResponse = PromotionDefinition;
export type OrderListResponse = Order[];
export type OrderResponse = Order;
