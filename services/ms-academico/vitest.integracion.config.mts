import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Pruebas de integración contra servicios reales (npm run test:integracion). No entran en npm test:
// necesitan ms-identidad levantado (ver el README y .github/workflows/ci-integracion.yml).
export default defineConfig({
  test: {
    globals: true,
    include: ['test/integracion/**/*.integracion.ts'],
    // Las pruebas de un archivo dependen del orden: la cuenta creada en la primera se usa en las siguientes
    sequence: { concurrent: false },
    testTimeout: 30_000,
    reporters: process.env.CI ? ['default', 'junit', 'json'] : ['default'],
    outputFile: { junit: 'reportes/integracion-junit.xml', json: 'reportes/integracion.json' },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
