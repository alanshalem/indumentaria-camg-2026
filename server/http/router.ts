import { notFound } from './errors';
import type { ApiRequest, ApiResponse, HttpMethod, RouteHandler } from './types';

interface Route {
  method: HttpMethod;
  segments: string[];
  handler: RouteHandler;
}

const toSegments = (path: string): string[] => path.split('/').filter(Boolean);

/**
 * Router mínimo: coincidencia exacta por segmentos con soporte de `:param`.
 * ~40 líneas contra una dependencia de framework entera. No necesitamos más
 * (sin wildcards, sin regex por ruta): YAGNI.
 */
export class Router {
  private readonly routes: Route[] = [];

  register(method: HttpMethod, pattern: string, handler: RouteHandler): this {
    this.routes.push({ method, segments: toSegments(pattern), handler });
    return this;
  }

  get = (pattern: string, handler: RouteHandler) => this.register('GET', pattern, handler);
  post = (pattern: string, handler: RouteHandler) => this.register('POST', pattern, handler);
  patch = (pattern: string, handler: RouteHandler) => this.register('PATCH', pattern, handler);
  delete = (pattern: string, handler: RouteHandler) => this.register('DELETE', pattern, handler);

  /** Monta otro router bajo un prefijo, para que cada módulo declare sus rutas. */
  use(prefix: string, router: Router): this {
    const prefixSegments = toSegments(prefix);
    for (const route of router.routes) {
      this.routes.push({ ...route, segments: [...prefixSegments, ...route.segments] });
    }
    return this;
  }

  resolve(request: ApiRequest): { handler: RouteHandler; params: Record<string, string> } {
    const segments = toSegments(request.path);
    let pathMatched = false;

    for (const route of this.routes) {
      const params = matchSegments(route.segments, segments);
      if (!params) continue;
      pathMatched = true;
      if (route.method === request.method) return { handler: route.handler, params };
    }

    throw notFound(
      pathMatched
        ? `Método ${request.method} no permitido en ${request.path}.`
        : `Ruta ${request.path} no encontrada.`,
    );
  }

  async handle(request: ApiRequest): Promise<ApiResponse> {
    const { handler, params } = this.resolve(request);
    return handler({ ...request, params });
  }
}

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | null {
  if (pattern.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i += 1) {
    const expected = pattern[i]!;
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual[i]!);
    } else if (expected !== actual[i]) {
      return null;
    }
  }
  return params;
}
