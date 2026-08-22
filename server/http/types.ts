/**
 * Contrato HTTP independiente del framework. El núcleo del servidor sólo conoce
 * estos dos tipos; Vercel y el dev-server de Vite entran por adaptadores.
 * (Patrón Ports & Adapters: el dominio no depende de la infraestructura.)
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';

export interface ApiRequest {
  method: HttpMethod;
  /** Path normalizado sin el prefijo `/api` y sin query string. Ej: `/products/medias`. */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  /** JSON ya parseado, o `undefined` si no había cuerpo. */
  body: unknown;
  ip: string;
  /** Parámetros de la ruta, poblados por el router. */
  params: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export type RouteHandler = (request: ApiRequest) => Promise<ApiResponse> | ApiResponse;
