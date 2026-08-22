import { fileURLToPath, URL } from 'node:url';
// defineConfig de vitest extiende el de vite: una sola config para build y tests.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { apiDevServer } from './tools/vitePluginApi';

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
        manualChunks: (id: string) => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
