import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/adapters/node';

/**
 * Única Function de Vercel: un catch-all que delega en el router del servidor.
 * Un solo artefacto para desplegar y un solo cold start para toda la API.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleNodeRequest(req, res);
}
