import type { Order } from '../domain/order.js';
import type { EmailKind, EmailNotice } from '../domain/orderEmails.js';

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
    summary: '/orders/summary',
    emails: (code: string) => `/orders/${encodeURIComponent(code)}/emails`,
    emailsPattern: '/orders/:code/emails',
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

/**
 * Respuesta del cambio de estado.
 *
 * Devuelve el pedido y **qué se le avisó al socio**. Sin esto el admin mueve el
 * estado y no tiene forma de saber si salió un mail, si ya se había mandado o
 * si el proveedor lo rechazó.
 */
export interface OrderStatusUpdate {
  order: Order;
  /** El aviso de este estado, o `null` si el estado no dispara ninguno. */
  notice: EmailNotice | null;
  /** Avisos de etapas ya superadas que nunca se enviaron. */
  missed: EmailKind[];
}

/**
 * Respuesta del checkout.
 *
 * Además del pedido devuelve el token que firma el link de seguimiento. Es
 * seguro dárselo a quien acaba de generarlo —sirve para ese pedido y nada más,
 * y le llega igual por mail—; sin esto el socio veía su código en pantalla y no
 * tenía forma de entrar a ver en qué andaba.
 */
export interface OrderCreated {
  order: Order;
  statusToken: string;
}

/** Una página de pedidos del panel, con el total que matchea el filtro. */
export interface OrderPage {
  orders: Order[];
  /** Cuántos pedidos matchean el filtro, más allá de esta página. */
  total: number;
}

/**
 * Los números de las tarjetas del panel.
 *
 * Los calcula el servidor sobre todo el filtro: sumarlos en el cliente daba el
 * total de la página visible, que con más de 50 pedidos no es el total de nada.
 * Los pedidos eliminados nunca entran.
 */
export interface OrderTotals {
  revenue: number;
  discounts: number;
  /** Ni entregados ni eliminados. */
  open: number;
  /** Cuántos pedidos entraron en estas cuentas. */
  counted: number;
}
