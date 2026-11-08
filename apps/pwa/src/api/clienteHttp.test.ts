import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClienteHttp, ErrorHttpApi } from './clienteHttp';

describe('ClienteHttp — manejo de token JWT en memoria y renovación de sesión', () => {
  let cliente: ClienteHttp;

  beforeEach(() => {
    cliente = new ClienteHttp('/api/identidad/auth/refresh');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('almacena, normaliza y limpia el token de acceso en memoria y lo adjunta en Authorization Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(cliente.obtenerTokenAcceso()).toBeNull();
    cliente.establecerTokenAcceso('   ');
    expect(cliente.obtenerTokenAcceso()).toBeNull();

    cliente.establecerTokenAcceso(' jwt-rs256-activo ');
    expect(cliente.obtenerTokenAcceso()).toBe('jwt-rs256-activo');

    await cliente.get('/api/identidad/auth/me');

    const [, opcionesLlamada] = fetchMock.mock.calls[0] as [string, RequestInit];
    const cabeceras = opcionesLlamada.headers as Headers;
    expect(cabeceras.get('Authorization')).toBe('Bearer jwt-rs256-activo');
    expect(cabeceras.get('Accept')).toBe('application/json');
    expect(opcionesLlamada.credentials).toBe('include');

    cliente.limpiarTokenAcceso();
    expect(cliente.obtenerTokenAcceso()).toBeNull();
  });

  it('omite Authorization cuando omitirAutenticacion es true y soporta POST/PUT/PATCH y 204 No Content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ actualizado: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      });
    vi.stubGlobal('fetch', fetchMock);

    cliente.establecerTokenAcceso('token-ignorame');

    const creado = await cliente.post<{ id: string }>(
      '/api/identidad/auth/login',
      { nombreUsuario: 'ana.perez', clave: '123' },
      { omitirAutenticacion: true },
    );
    expect(creado.id).toBe('1');

    const [, opcionesPost] = fetchMock.mock.calls[0] as [string, RequestInit];
    const cabecerasPost = opcionesPost.headers as Headers;
    expect(cabecerasPost.get('Authorization')).toBeNull();
    expect(cabecerasPost.get('Content-Type')).toBe('application/json');

    const actualizado = await cliente.put<{ actualizado: boolean }>(
      '/api/identidad/usuarios/1/roles',
      '{"roles":["DOCENTE"]}',
    );
    expect(actualizado.actualizado).toBe(true);

    const sinContenido = await cliente.patch<undefined>(
      '/api/identidad/usuarios/1',
      { estado: 'ACTIVO', version: 0 },
    );
    expect(sinContenido).toBeUndefined();
  });

  it('renueva automáticamente el token en caso de 401 y reintenta la petición original una sola vez', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            codigo: 'TOKEN_EXPIRADO',
            mensaje: 'El token ha expirado',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            accessToken: 'nuevo-jwt-rotado',
            tokenType: 'Bearer',
            expiresIn: 900,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ nombreUsuario: 'ana.perez' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    cliente.establecerTokenAcceso('jwt-vencido');
    const perfil = await cliente.get<{ nombreUsuario: string }>(
      '/api/identidad/auth/me',
    );

    expect(perfil.nombreUsuario).toBe('ana.perez');
    expect(cliente.obtenerTokenAcceso()).toBe('nuevo-jwt-rotado');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('notifica sesión expirada y limpia el token cuando la renovación por 401 falla o rechaza', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            codigo: 'NO_AUTORIZADO',
            mensaje: 'Sesión inválida',
            detalles: ['Token revocado'],
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
    vi.stubGlobal('fetch', fetchMock);

    cliente.establecerTokenAcceso('jwt-vencido');
    const oyenteExpiracion = vi.fn();
    const cancelar = cliente.alExpirarSesion(oyenteExpiracion);

    await expect(cliente.get('/api/identidad/auth/me')).rejects.toBeInstanceOf(
      ErrorHttpApi,
    );

    expect(cliente.obtenerTokenAcceso()).toBeNull();
    expect(oyenteExpiracion).toHaveBeenCalledTimes(1);

    cancelar();
  });

  it('notifica cambio obligatorio de clave cuando recibe 403 con código CAMBIO_CLAVE_REQUERIDO y maneja errores sin JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            codigo: 'CAMBIO_CLAVE_REQUERIDO',
            mensaje: 'Debe cambiar su clave inicial',
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('Bad Gateway HTML')),
      });
    vi.stubGlobal('fetch', fetchMock);

    const oyenteCambioClave = vi.fn();
    const cancelar = cliente.alRequerirCambioClave(oyenteCambioClave);

    await expect(
      cliente.get('/api/academico/matriculas'),
    ).rejects.toMatchObject({
      estado: 403,
      codigo: 'CAMBIO_CLAVE_REQUERIDO',
    });
    expect(oyenteCambioClave).toHaveBeenCalledTimes(1);

    cancelar();

    await expect(
      cliente.get('/api/academico/matriculas'),
    ).rejects.toMatchObject({
      estado: 502,
      codigo: 'HTTP_502',
    });
  });
});

