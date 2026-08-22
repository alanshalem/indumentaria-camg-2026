import { loadEnv, type Plugin } from 'vite';

/**
 * Monta la misma API que corre en Vercel dentro del dev-server de Vite.
 * Sin esto haría falta `vercel dev` para probar `/api`, o —peor— habría dos
 * implementaciones del backend que se desincronizarían.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'camg:api-dev-server',
    apply: 'serve',

    config(_config, { mode }) {
      // Vite sólo expone las VITE_* al cliente vía import.meta.env. El backend
      // lee process.env (igual que en Vercel), así que hay que hidratarlo acá.
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        // Import perezoso vía el pipeline de Vite: editar `server/` recarga en
        // caliente sin reiniciar el dev-server.
        server
          .ssrLoadModule('/server/adapters/node.ts')
          .then((module) =>
            (module as { handleNodeRequest: (a: typeof req, b: typeof res) => Promise<void> })
              .handleNodeRequest(req, res),
          )
          .catch(next);
      });
    },
  };
}
