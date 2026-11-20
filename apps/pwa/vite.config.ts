import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cálculo de notas compartido con ms-academico (T1117-A). En la imagen Docker llega como
// contexto adicional en /packages/calculo-notas, la misma ruta relativa que en el repositorio.
const paqueteCalculo = fileURLToPath(new URL('../../packages/calculo-notas', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aulaconecta/calculo-notas': `${paqueteCalculo}/src/index.ts`,
    },
  },
  server: {
    port: 5173,
    fs: {
      // El servidor de desarrollo también sirve el paquete, que está fuera de apps/pwa
      allow: [searchForWorkspaceRoot(process.cwd()), paqueteCalculo],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
