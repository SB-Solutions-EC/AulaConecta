import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compila los decoradores con sus metadatos, que NestJS necesita para la inyección de dependencias.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
