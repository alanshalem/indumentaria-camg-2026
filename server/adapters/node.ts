import type { IncomingMessage, ServerResponse } from 'node:http';
import { badRequest, payloadTooLarge } from '../http/errors';
import type { ApiRequest, HttpMethod } from '../http/types';
import { handleApiRequest } from '../app';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const API_PREFIX = '/api';
/** Query param donde `vercel.json` deja la ruta original al reescribir. */
const PATH_PARAM = 'path';

/**
 * Adaptador Node ⇄ núcleo HTTP. Lo usan tanto las Functions de Vercel como el
 * middleware del dev-server de Vite, así que `npm run dev` y producción
 * ejecutan exactamente el mismo código de backend.
 */
export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const request = await toApiRequest(req);
    const response = await handleApiRequest(request);

    res.statusCode = response.status;
    for (const [key, value] of Object.entries(response.headers ?? {})) res.setHeader(key, value);

    if (response.body === undefined) {
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(response.body));
  } catch (error) {
    console.error('[api] fallo del adaptador:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } }));
  }
}

/**
 * En Vercel la ruta real no llega en el pathname: `vercel.json` reescribe
 * `/api/algo/mas` a `/api?path=algo/mas`, así que se lee de ahí. En el
 * dev-server de Vite el pathname sí es el original y se usa ese.
 */
function resolvePath(url: URL): string {
  const rewritten = url.searchParams.get(PATH_PARAM);
  if (rewritten !== null) return `/${rewritten.replace(/^\/+/, '')}`;

  const { pathname } = url;
  return pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) || '/' : pathname;
}

async function toApiRequest(req: IncomingMessage): Promise<ApiRequest> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = resolvePath(url);

  // El parámetro de ruteo es infraestructura, no un filtro de la API.
  url.searchParams.delete(PATH_PARAM);

  return {
    method: (req.method ?? 'GET').toUpperCase() as HttpMethod,
    path: path || '/',
    query: Object.fromEntries(url.searchParams),
    headers: normalizeHeaders(req.headers),
    body: await readJsonBody(req),
    ip: clientIp(req),
    params: {},
  };
}

const normalizeHeaders = (headers: IncomingMessage['headers']): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(',') : value]),
  );

const clientIp = (req: IncomingMessage): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') return undefined;

  // Vercel ya parsea el body en algunos runtimes: si viene resuelto, se respeta.
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed !== undefined && preParsed !== null && typeof preParsed !== 'string') return preParsed;

  const raw = typeof preParsed === 'string' ? preParsed : await readRawBody(req);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('El cuerpo del request no es JSON válido.');
  }
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(payloadTooLarge('El cuerpo del request supera el límite permitido.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
