import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/adapters/node';

/**
 * Única Function de Vercel: un solo artefacto y un solo cold start para toda la API.
 *
 * El ruteo interno lo hace `server/http/router.ts`. Acá NO se usa un archivo
 * `[...path].ts`: el catch-all con corchetes es convención de Next.js y en un
 * proyecto de Functions sueltas Vercel lo trata como un segmento único, así que
 * `/api/auth/login` (dos segmentos) devolvía 404. En su lugar, `vercel.json`
 * reescribe `/api/*` hacia acá pasando la ruta original en `?path=`.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleNodeRequest(req, res);
}
