import { fileURLToPath, URL } from 'node:url';
// defineConfig de vitest extiende el de vite: una sola config para build y tests.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { apiDevServer } from './tools/vitePluginApi';

/** Dependencias que sólo se bajan cuando hacen falta (ver `import()` en el código). */
const LAZY_DEPENDENCIES = ['write-excel-file'];

/** Rutas POSIX: Rollup no resuelve bien alias con separadores de Windows. */
const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url)).split('\\').join('/');

export default defineConfig({
  plugins: [react(), apiDevServer()],
  resolve: {
    // Array ordenado a propósito: '@shared' debe evaluarse ANTES que '@',
    // porque '@shared/...' también empieza con '@'.
    alias: [
      { find: '@shared', replacement: resolvePath('./shared') },
      { find: '@', replacement: resolvePath('./src') },
    ],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separar el vendor estabiliza el cache del browser entre deploys:
        // el código de la app cambia seguido, las dependencias casi nunca.
        // Las de LAZY_DEPENDENCIES quedan afuera a propósito: se importan con
        // `import()` y meterlas en el vendor las volvería a cargar de entrada.
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (LAZY_DEPENDENCIES.some((name) => id.includes(name))) return undefined;
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
