import { getConfig } from '../../server/config/env';
import { unauthorized } from '../../server/http/errors';
import { makeApiHandler, makeApiRouter } from '../../server/app';
import type { ApiRequest, ApiResponse, HttpMethod } from '../../server/http/types';
import { ADMIN_SUBJECT } from '../../server/security/adminGuard';
import { createToken } from '../../server/security/token';
import { createEmailsService } from '../../server/modules/emails/emails.service';
import { createOrdersService } from '../../server/modules/orders/orders.service';
import { createProductsService } from '../../server/modules/products/products.service';
import { createPromotionsService } from '../../server/modules/promotions/promotions.service';
import { makeAuthRoutes } from '../../server/modules/auth/auth.routes';
import type { login } from '../../server/modules/auth/auth.service';
import { makeEmailRoutes } from '../../server/modules/emails/emails.routes';
import { makeOrderRoutes } from '../../server/modules/orders/orders.routes';
import { makeProductRoutes } from '../../server/modules/products/products.routes';
import { makePromotionRoutes } from '../../server/modules/promotions/promotions.routes';
import { makeUploadRoutes } from '../../server/modules/uploads/uploads.routes';
import type { ImageStorage } from '../../server/infra/imageStorage';
import type { Order } from '../../shared/domain/order';
import type { Product } from '../../shared/domain/product';
import type { PromotionDefinition } from '../../shared/domain/promotions';
import {
  fakeEmailLog,
  fakeOrders,
  fakeProducts,
  fakePromotions,
  fakeStock,
  fakeWhatsappLog,
} from './repositories';
import { fakeTransport } from './services';

/**
 * Una API entera armada con dobles, para poder pedirle cosas por HTTP.
 *
 * Es lo que las fábricas de routers habilitan: el borde real —matcheo de rutas,
 * `adminOnly`, validación con zod, el sobre de error, los headers— corriendo
 * sobre repositorios en memoria. Debajo van los servicios de verdad, así que
 * estos tests cubren la pila completa salvo Supabase.
 */
export interface TestApi {
  /** Pide sin credenciales, como un visitante. */
  request(method: HttpMethod, path: string, init?: RequestInit): Promise<ApiResponse>;
  /** Pide con una sesión de admin válida. */
  admin(method: HttpMethod, path: string, init?: RequestInit): Promise<ApiResponse>;
  /** Estado de los dobles, leído en vivo, para afirmar sobre efectos. */
  readonly state: {
    readonly orders: readonly Order[];
    /** Mensajes que salieron por el transporte de mails. */
    readonly sent: readonly { to: string; subject: string }[];
    readonly uploaded: readonly string[];
  };
}

/** La contraseña del admin en los tests, sin relación con la del `.env.local`. */
export const TEST_PASSWORD = 'la-clave-de-los-tests';

interface RequestInit {
  body?: unknown;
  query?: Record<string, string>;
  /** Un token cualquiera, para ensayar el caso de credenciales inválidas. */
  token?: string;
}

export interface TestApiSeed {
  /**
   * Qué hace el login. Por defecto acepta `TEST_PASSWORD` y rechaza el resto:
   * el router se prueba sin depender de `ADMIN_PASSWORD` del entorno, que es
   * la del club. La comparación en sí vive en `login()` y usa `safeEquals`,
   * cubierto en `security.test.ts`.
   */
  signIn?: typeof login;
  products?: Product[];
  orders?: Order[];
  promotions?: PromotionDefinition[];
  /** Variante → unidades. Lo que no esté acá no tiene stock cargado. */
  stock?: Record<string, number>;
  /** Avisos que esos pedidos ya habían recibido. */
  emailsAlreadySent?: Parameters<typeof fakeEmailLog>[0];
}

export function testApi(seed: TestApiSeed = {}): TestApi {
  const orders = fakeOrders(seed.orders ?? []);
  const products = fakeProducts(seed.products ?? []);
  const promotions = fakePromotions(seed.promotions ?? []);
  const stock = fakeStock(seed.stock ?? {});
  const whatsapp = fakeWhatsappLog();
  const { transport, sent } = fakeTransport();
  const { repository: emailLog } = fakeEmailLog(seed.emailsAlreadySent ?? []);

  const emails = createEmailsService(transport, emailLog, orders);
  const ordersService = createOrdersService(
    orders,
    products,
    promotions,
    emails,
    stock.repository,
    whatsapp.repository,
  );

  const uploaded: string[] = [];
  const storage: ImageStorage = {
    upload: async ({ fileName }) => {
      uploaded.push(fileName);
      return `https://storage.test/${fileName}`;
    },
  };

  const handle = makeApiHandler(
    makeApiRouter([
      makeAuthRoutes(seed.signIn ?? defaultSignIn),
      makeProductRoutes(createProductsService(products)),
      makePromotionRoutes(createPromotionsService(promotions)),
      makeOrderRoutes(ordersService, emails),
      makeUploadRoutes(storage),
      makeEmailRoutes(emails),
    ]),
  );

  const send = (method: HttpMethod, path: string, init: RequestInit, auth?: string) =>
    handle({
      method,
      path,
      query: init.query ?? {},
      headers: auth ? { authorization: `Bearer ${auth}` } : {},
      body: init.body,
      ip: '127.0.0.1',
      params: {},
    } satisfies ApiRequest);

  return {
    request: (method, path, init = {}) => send(method, path, init, init.token),
    admin: (method, path, init = {}) => send(method, path, init, init.token ?? adminToken()),
    // Getters y no una copia: los efectos se producen durante el request, así
    // que una foto tomada al armar la API siempre estaría vacía.
    state: {
      get orders() {
        return orders.saved;
      },
      get sent() {
        return sent.map((message) => ({ to: message.to, subject: message.subject }));
      },
      get uploaded() {
        return uploaded;
      },
    },
  };
}

/** Login de prueba: emite una sesión real, pero contra una clave de test. */
const defaultSignIn: typeof login = (password) => {
  if (password !== TEST_PASSWORD) throw unauthorized('Clave incorrecta.');
  const now = Date.now();
  return { token: adminToken(), expiresAt: now + 60_000 };
};

/** Una sesión de admin firmada con el secreto que usa el server en los tests. */
export function adminToken(expiresInMs = 60_000): string {
  const now = Date.now();
  return createToken(
    { sub: ADMIN_SUBJECT, iat: now, exp: now + expiresInMs },
    getConfig().tokenSecret,
  );
}

/** El sobre de error, con el shape que el cliente sabe leer. */
export const errorOf = (response: ApiResponse): { code: string; message: string; fields?: Record<string, string> } =>
  (response.body as { error: { code: string; message: string; fields?: Record<string, string> } }).error;

/** El `{ data }` de una respuesta exitosa. */
export const dataOf = <T>(response: ApiResponse): T => (response.body as { data: T }).data;
