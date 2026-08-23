import './support/serverEnv';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signOrderToken, verifyOrderToken } from '../server/security/orderToken';

const CODE = 'CAMG-2026-ABCDE';
const OTHER = 'CAMG-2026-ZZZZZ';

describe('token del link de seguimiento', () => {
  it('firma igual el mismo código: los tres mails llevan el mismo link', () => {
    expect(signOrderToken(CODE)).toBe(signOrderToken(CODE));
  });

  it('acepta su propia firma', () => {
    expect(verifyOrderToken(CODE, signOrderToken(CODE))).toBe(true);
  });

  it('no acepta la firma de otro pedido', () => {
    expect(verifyOrderToken(CODE, signOrderToken(OTHER))).toBe(false);
  });

  it('rechaza un token vacío, manipulado o de otro largo', () => {
    const token = signOrderToken(CODE);
    expect(verifyOrderToken(CODE, '')).toBe(false);
    expect(verifyOrderToken(CODE, `${token}x`)).toBe(false);
    expect(verifyOrderToken(CODE, token.slice(0, -1))).toBe(false);
    expect(verifyOrderToken(CODE, 'a'.repeat(token.length))).toBe(false);
  });

  it('es URL-safe: viaja en la query sin escaparse', () => {
    expect(signOrderToken(CODE)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  /**
   * La clave del link se deriva del secreto de admin, no es el secreto. Si
   * alguien juntara muchos links, no obtiene nada aplicable a las sesiones.
   */
  it('no es el HMAC directo del secreto de admin', () => {
    const secret = process.env['ADMIN_TOKEN_SECRET'] ?? '';
    const naive = createHmac('sha256', secret).update(CODE).digest('base64url');
    expect(signOrderToken(CODE)).not.toBe(naive);
  });
});
