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

    expect(cargarConfiguracion()).toMatchObject({ entorno: 'development', puerto: 3000, swaggerHabilitado: true });
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

  it('por defecto llama a ms-identidad por la red interna como ms-academico', () => {
    vi.stubEnv('IDENTIDAD_URL', '');
    vi.stubEnv('AULACONECTA_CLIENTE_ID', '');
    vi.stubEnv('AULACONECTA_CLIENTE_SECRETO_ARCHIVO', '');

    expect(cargarConfiguracion().identidad).toEqual({
      url: 'http://ms-identidad:8080',
      clienteId: 'ms-academico',
      secretoArchivo: undefined,
      tiempoMaximoMs: 5000,
    });
  });

  it('toma la URL, el cliente y el archivo del secreto del entorno', () => {
    vi.stubEnv('IDENTIDAD_URL', 'https://identidad.interno:8443/');
    vi.stubEnv('AULACONECTA_CLIENTE_ID', 'ms-otro');
    vi.stubEnv('AULACONECTA_CLIENTE_SECRETO_ARCHIVO', '/run/secrets/identidad/secreto');

    expect(cargarConfiguracion().identidad).toMatchObject({
      url: 'https://identidad.interno:8443',
      clienteId: 'ms-otro',
      secretoArchivo: '/run/secrets/identidad/secreto',
    });
  });

  it.each(['no es url', 'file:///etc/passwd', 'ftp://ms-identidad'])('rechaza IDENTIDAD_URL = %s', (valor) => {
    vi.stubEnv('IDENTIDAD_URL', valor);

    expect(() => cargarConfiguracion()).toThrow('IDENTIDAD_URL');
  });
});
