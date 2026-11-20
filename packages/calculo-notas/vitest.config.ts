import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // En el CI también quedan los resultados (JUnit y JSON): son la evidencia del indicador I-05
    reporters: process.env.CI ? ['default', 'junit', 'json'] : ['default'],
    outputFile: { junit: 'reportes/junit.xml', json: 'reportes/resultados.json' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // El cálculo de notas es crítico (RNF-02): toda línea y rama debe estar probada
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
