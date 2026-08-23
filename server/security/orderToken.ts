import { createHmac } from 'node:crypto';
import { getConfig } from '../config/env.js';
import { safeEquals } from './token.js';

/**
 * Firma del link "ver el estado de mi pedido".
 *
 * El socio no tiene cuenta, pero **sí tiene una prueba de identidad: el mail**.
 * Sólo el dueño de esa casilla recibe el link, así que la firma no autentica a
 * una persona — autoriza el acceso a UN pedido puntual.
 *
 * Es determinística a propósito: los tres mails del pedido llevan el mismo
 * link, y uno viejo sigue funcionando. Sin expiración, sin tabla de tokens,
 * sin sesión.
 */

/**
 * Separación de dominio: la clave del link se deriva de `ADMIN_TOKEN_SECRET`
 * pero no es esa clave. Si un link se filtrara, no acerca a nadie al secreto
 * que firma las sesiones de administrador.
 */
const LINK_CONTEXT = 'camg:order-status-link:v1';

const linkKey = (secret: string): Buffer =>
  createHmac('sha256', secret).update(LINK_CONTEXT).digest();

export function signOrderToken(code: string): string {
  const { tokenSecret } = getConfig();
  return createHmac('sha256', linkKey(tokenSecret)).update(code).digest('base64url');
}

/** Comparación en tiempo constante: no filtra cuántos bytes coincidieron. */
export const verifyOrderToken = (code: string, token: string): boolean =>
  token.length > 0 && safeEquals(token, signOrderToken(code));
