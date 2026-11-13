import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compila los decoradores con sus metadatos, que NestJS necesita para la inyección de dependencias.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // En el CI también se guardan los resultados (JUnit y JSON) para el reporte de pruebas
    reporters: process.env.CI ? ['default', 'junit', 'json'] : ['default'],
    outputFile: { junit: 'reportes/junit.xml', json: 'reportes/resultados.json' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.spec.ts'],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
