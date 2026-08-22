import { API_BASE } from '@shared/api/contracts';
import { isErrorEnvelope, type ApiEnvelope } from '@shared/api/errors';
import { ApiError } from './apiError';

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

const buildUrl = (path: string, query?: RequestOptions['query']): string => {
  const base = `${import.meta.env.VITE_API_BASE_URL ?? ''}${API_BASE}${path}`;
  if (!query) return base;
  const params = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

/**
 * Fachada única sobre `fetch`. Centraliza el header de autorización, el
 * desempaquetado del sobre `{ data } | { error }` y la traducción a ApiError.
 * Ningún componente vuelve a tocar `fetch` ni conoce la forma del sobre.
 */
export class HttpClient {
  private getToken: TokenProvider = () => null;
  private onUnauthorized: UnauthorizedHandler = () => {};

  /** Inyectado por el AuthProvider al montar: evita un import circular. */
  configure(options: { getToken: TokenProvider; onUnauthorized: UnauthorizedHandler }): void {
    this.getToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...options, body });
  }
  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ?? null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw ApiError.network();
    }

    if (response.status === 204) return undefined as T;

    const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok || !envelope || isErrorEnvelope(envelope)) {
      const error = new ApiError(
        envelope && isErrorEnvelope(envelope)
          ? envelope.error
          : { code: 'INTERNAL_ERROR', message: `Error ${response.status} del servidor.` },
        response.status,
      );
      if (error.isAuthProblem) this.onUnauthorized();
      throw error;
    }

    return envelope.data;
  }
}

export const httpClient = new HttpClient();
