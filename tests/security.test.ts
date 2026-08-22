import { describe, expect, it } from 'vitest';
import { createToken, safeEquals, verifyToken } from '../server/security/token';
import { SlidingWindowRateLimiter } from '../server/security/rateLimit';
import { Router } from '../server/http/router';
import { HttpError } from '../server/http/errors';
import type { ApiRequest } from '../server/http/types';

const SECRET = 'secreto-de-prueba-suficientemente-largo';

const request = (method: ApiRequest['method'], path: string): ApiRequest => ({
  method,
  path,
  query: {},
  headers: {},
  body: undefined,
  ip: '1.2.3.4',
  params: {},
});

describe('token', () => {
  it('firma y verifica un token válido', () => {
    const payload = { sub: 'admin', iat: Date.now(), exp: Date.now() + 60_000 };
    expect(verifyToken(createToken(payload, SECRET), SECRET)).toEqual(payload);
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = createToken({ sub: 'admin', iat: 0, exp: Date.now() + 60_000 }, 'otro-secreto');
    expect(() => verifyToken(token, SECRET)).toThrow(HttpError);
  });

  it('rechaza un payload manipulado', () => {
    const token = createToken({ sub: 'admin', iat: 0, exp: Date.now() + 60_000 }, SECRET);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', iat: 0, exp: 9e15 })).toString('base64url');
    expect(() => verifyToken(`${header}.${forged}.${signature}`, SECRET)).toThrow(/firma/i);
  });

  it('rechaza un token expirado', () => {
    const token = createToken({ sub: 'admin', iat: 0, exp: Date.now() - 1 }, SECRET);
    expect(() => verifyToken(token, SECRET)).toThrow(/expir/i);
  });

  it('compara en tiempo constante sin romperse con largos distintos', () => {
    expect(safeEquals('abc', 'abc')).toBe(true);
    expect(safeEquals('abc', 'abcd')).toBe(false);
    expect(safeEquals('', '')).toBe(true);
  });
});

describe('rate limiter', () => {
  it('deja pasar hasta el límite y después bloquea', () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    expect(() => {
      limiter.consume('ip', 0);
      limiter.consume('ip', 100);
      limiter.consume('ip', 200);
    }).not.toThrow();
    expect(() => limiter.consume('ip', 300)).toThrow(/Demasiados intentos/);
  });

  it('libera el cupo al salir de la ventana', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.consume('ip', 0);
    expect(() => limiter.consume('ip', 500)).toThrow();
    expect(() => limiter.consume('ip', 1500)).not.toThrow();
  });

  it('aísla identificadores distintos', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.consume('ip-a', 0);
    expect(() => limiter.consume('ip-b', 0)).not.toThrow();
  });
});

describe('router', () => {
  const router = new Router()
    .get('/products', () => ({ status: 200, body: { data: 'lista' } }))
    .get('/products/:id', (req) => ({ status: 200, body: { data: req.params.id } }))
    .post('/products', () => ({ status: 201 }));

  it('resuelve rutas estáticas', async () => {
    await expect(router.handle(request('GET', '/products'))).resolves.toMatchObject({ status: 200 });
  });

  it('extrae parámetros de ruta', async () => {
    const response = await router.handle(request('GET', '/products/medias-3-4'));
    expect(response.body).toEqual({ data: 'medias-3-4' });
  });

  it('decodifica parámetros con caracteres especiales', async () => {
    const response = await router.handle(request('GET', '/products/campera%20roja'));
    expect(response.body).toEqual({ data: 'campera roja' });
  });

  it('distingue 404 de método no permitido', async () => {
    await expect(router.handle(request('GET', '/desconocido'))).rejects.toThrow(/no encontrada/);
    await expect(router.handle(request('DELETE', '/products'))).rejects.toThrow(/no permitido/);
  });

  it('monta subrouters bajo un prefijo', async () => {
    const mounted = new Router().use('/admin', router);
    await expect(mounted.handle(request('GET', '/admin/products'))).resolves.toMatchObject({ status: 200 });
  });
});
