import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarConfiguracion } from './configuracion';

describe('cargarConfiguracion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa el puerto 3000 y Swagger encendido por defecto en desarrollo', () => {
    vi.stubEnv('PORT', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SWAGGER_HABILITADO', '');
    delete process.env.PORT;
    delete process.env.SWAGGER_HABILITADO;

    expect(cargarConfiguracion()).toEqual({ entorno: 'development', puerto: 3000, swaggerHabilitado: true });
  });

  it('apaga Swagger en producción salvo que se pida', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.SWAGGER_HABILITADO;

    expect(cargarConfiguracion().swaggerHabilitado).toBe(false);
  });

  it('rechaza un puerto inválido', () => {
    vi.stubEnv('PORT', 'abc');

    expect(() => cargarConfiguracion()).toThrow('PORT no es un puerto válido');
  });
});
