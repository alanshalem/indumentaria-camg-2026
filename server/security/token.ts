import { createHmac, timingSafeEqual } from 'node:crypto';
import { unauthorized } from '../http/errors.js';

/**
 * JWT HS256 mínimo sobre `node:crypto`. Firmar y verificar un token opaco son
 * ~40 líneas; agregar `jsonwebtoken` sólo para esto sería peso muerto.
 */
export interface TokenPayload {
  /** subject: siempre 'admin' en este sistema de un solo rol. */
  sub: string;
  /** issued at (epoch ms) */
  iat: number;
  /** expiración (epoch ms) */
  exp: number;
}

const HEADER = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value as never).toString('base64url');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Comparación en tiempo constante: no filtra cuántos bytes coincidieron. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Igual consumimos tiempo comparando contra sí mismo para no revelar el largo.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function createToken(payload: TokenPayload, secret: string): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${HEADER}.${body}`;
  return `${data}.${sign(data, secret)}`;
}

export function verifyToken(token: string, secret: string, now = Date.now()): TokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw unauthorized('Token malformado.');

  const [header, body, signature] = parts as [string, string, string];
  if (!safeEquals(signature, sign(`${header}.${body}`, secret))) {
    throw unauthorized('Firma de token inválida.');
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    throw unauthorized('Token malformado.');
  }

  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw unauthorized('La sesión expiró. Ingresá de nuevo.');
  }
  return payload;
}
