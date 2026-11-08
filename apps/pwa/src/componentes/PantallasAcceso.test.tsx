import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClienteHttp,
  ErrorHttpApi,
  type RespuestaTokenAcceso,
} from '../api/clienteHttp';
import { ServicioAutenticacionApi } from '../api/autenticacionApi';
import { PantallaCambioClaveInicial } from './PantallaCambioClaveInicial';
import { PantallaInicioSesion } from './PantallaInicioSesion';

const RESPUESTA_TOKEN_PRUEBA: RespuestaTokenAcceso = {
  accessToken: 'jwt-rs256-valido',
  tokenType: 'Bearer',
  expiresIn: 900,
  usuario: {
    id: '11111111-2222-3333-4444-555555555555',
    nombreUsuario: 'carlos.mora',
    roles: ['DOCENTE'],
    debeCambiarClave: false,
    estado: 'ACTIVO',
    intentosFallidos: 0,
    version: 1,
  },
};

describe('Pantallas de inicio de sesión y cambio obligatorio de clave inicial (T1105-C)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ServicioAutenticacionApi invoca /auth/login, /auth/cambiar-clave y /auth/me actualizando el token en memoria', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(RESPUESTA_TOKEN_PRUEBA),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...RESPUESTA_TOKEN_PRUEBA,
            accessToken: 'jwt-renovado-clave',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(RESPUESTA_TOKEN_PRUEBA.usuario),
      });
    vi.stubGlobal('fetch', fetchMock);

    const cliente = new ClienteHttp();
    const servicio = new ServicioAutenticacionApi(cliente);

    const sesion = await servicio.iniciarSesion({
      nombreUsuario: '  carlos.mora  ',
      clave: '1600000000',
    });
    expect(sesion.accessToken).toBe('jwt-rs256-valido');
    expect(cliente.obtenerTokenAcceso()).toBe('jwt-rs256-valido');

    const sesionActualizada = await servicio.cambiarClaveInicial({
      claveActual: '1600000000',
      claveNueva: 'ClaveSegura2026!',
    });
    expect(sesionActualizada.accessToken).toBe('jwt-renovado-clave');
    expect(cliente.obtenerTokenAcceso()).toBe('jwt-renovado-clave');

    const perfil = await servicio.obtenerPerfilActual();
    expect(perfil.nombreUsuario).toBe('carlos.mora');
  });

  it('PantallaInicioSesion valida campos vacíos, permite mostrar/ocultar clave y autentica exitosamente', async () => {
    const alAutenticar = vi.fn();
    const ejecutarLogin = vi.fn().mockResolvedValue(RESPUESTA_TOKEN_PRUEBA);

    render(
      <PantallaInicioSesion
        alAutenticarExitosamente={alAutenticar}
        ejecutarLogin={ejecutarLogin}
      />,
    );

    // Enviar formulario vacío muestra alerta de campos obligatorios
    fireEvent.click(screen.getByTestId('boton-enviar-login'));
    expect(screen.getByTestId('alerta-error-login')).toHaveTextContent(
      /Campos obligatorios/i,
    );

    const inputUsuario = screen.getByLabelText(/Nombre de usuario/i);
    const inputClave = screen.getByLabelText(/Contraseña o clave inicial/i);

    fireEvent.change(inputUsuario, { target: { value: 'carlos.mora' } });
    fireEvent.change(inputClave, { target: { value: '1600000000' } });

    // Alternar visibilidad de la contraseña
    const botonVisibilidad = screen.getByRole('button', {
      name: /Mostrar contraseña/i,
    });
    fireEvent.click(botonVisibilidad);
    expect(inputClave).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByTestId('boton-enviar-login'));

    await waitFor(() => {
      expect(ejecutarLogin).toHaveBeenCalledWith({
        nombreUsuario: 'carlos.mora',
        clave: '1600000000',
      });
      expect(alAutenticar).toHaveBeenCalledWith(RESPUESTA_TOKEN_PRUEBA);
    });
  });

  it('PantallaInicioSesion muestra errores de credenciales inválidas (401), cuenta bloqueada (423) y fallo de red', async () => {
    const ejecutarLogin = vi
      .fn()
      .mockRejectedValueOnce(
        new ErrorHttpApi(
          401,
          'CREDENCIALES_INVALIDAS',
          'Usuario o contraseña incorrectos',
        ),
      )
      .mockRejectedValueOnce(
        new ErrorHttpApi(
          423,
          'CUENTA_BLOQUEADA',
          'La cuenta está bloqueada temporalmente',
        ),
      )
      .mockRejectedValueOnce(new Error('Fallo de red'));

    render(
      <PantallaInicioSesion
        nombreUsuarioInicial="ana.perez"
        alAutenticarExitosamente={vi.fn()}
        ejecutarLogin={ejecutarLogin}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Contraseña o clave inicial/i), {
      target: { value: 'clave-erronea' },
    });

    // Intento 1: 401 Credenciales inválidas
    fireEvent.click(screen.getByTestId('boton-enviar-login'));
    await waitFor(() => {
      expect(screen.getByTestId('alerta-error-login')).toHaveTextContent(
        /Credenciales inválidas/i,
      );
    });

    // Intento 2: 423 Cuenta bloqueada
    fireEvent.click(screen.getByTestId('boton-enviar-login'));
    await waitFor(() => {
      expect(screen.getByTestId('alerta-error-login')).toHaveTextContent(
        /Cuenta bloqueada temporalmente/i,
      );
    });

    // Intento 3: Error de red genérico
    fireEvent.click(screen.getByTestId('boton-enviar-login'));
    await waitFor(() => {
      expect(screen.getByTestId('alerta-error-login')).toHaveTextContent(
        /Error de conexión con ms-identidad/i,
      );
    });
  });

  it('PantallaCambioClaveInicial valida reglas RF-03 (longitud, repetición, igual al usuario, confirmación) y actualiza la clave', async () => {
    const alCambiar = vi.fn();
    const ejecutarCambio = vi
      .fn()
      .mockRejectedValueOnce(
        new ErrorHttpApi(
          400,
          'CLAVE_ACTUAL_INCORRECTA',
          'La clave actual no es correcta',
        ),
      )
      .mockResolvedValueOnce(RESPUESTA_TOKEN_PRUEBA);

    render(
      <PantallaCambioClaveInicial
        nombreUsuario="carlos.mora"
        tituloModuloBloqueado="Panel principal"
        alCambiarClaveExitosamente={alCambiar}
        ejecutarCambioClave={ejecutarCambio}
      />,
    );

    const botonGuardar = screen.getByTestId('boton-guardar-cambio-clave');
    const campoActual = screen.getByLabelText(/Clave actual/i);
    const campoNueva = screen.getByLabelText(/Nueva contraseña/i);
    const campoConfirmar = screen.getByLabelText(/Confirmar nueva contraseña/i);

    // 1. Campos vacíos
    fireEvent.click(botonGuardar);
    expect(screen.getByTestId('alerta-error-cambio-clave')).toHaveTextContent(
      /Complete todos los campos/i,
    );

    // 2. Menos de 8 caracteres
    fireEvent.change(campoActual, { target: { value: '1600000000' } });
    fireEvent.change(campoNueva, { target: { value: 'corta12' } });
    fireEvent.change(campoConfirmar, { target: { value: 'corta12' } });
    fireEvent.click(botonGuardar);
    expect(screen.getByTestId('alerta-error-cambio-clave')).toHaveTextContent(
      /al menos 8 caracteres/i,
    );

    // 3. Igual a la clave actual
    fireEvent.change(campoNueva, { target: { value: '1600000000' } });
    fireEvent.change(campoConfirmar, { target: { value: '1600000000' } });
    fireEvent.click(botonGuardar);
    expect(screen.getByTestId('alerta-error-cambio-clave')).toHaveTextContent(
      /distinta de su clave inicial/i,
    );

    // 4. Igual al nombre de usuario
    fireEvent.change(campoNueva, { target: { value: 'carlos.mora' } });
    fireEvent.change(campoConfirmar, { target: { value: 'carlos.mora' } });
    fireEvent.click(botonGuardar);
    expect(screen.getByTestId('alerta-error-cambio-clave')).toHaveTextContent(
      /no puede ser igual a su nombre de usuario/i,
    );

    // 5. Confirmación distinta
    fireEvent.change(campoNueva, { target: { value: 'NuevaClaveSegura1' } });
    fireEvent.change(campoConfirmar, { target: { value: 'OtraClaveDistinta2' } });
    fireEvent.click(botonGuardar);
    expect(screen.getByTestId('alerta-error-cambio-clave')).toHaveTextContent(
      /no coincide/i,
    );

    // 6. Error devuelto por la API (400 CLAVE_ACTUAL_INCORRECTA)
    fireEvent.change(campoConfirmar, { target: { value: 'NuevaClaveSegura1' } });
    fireEvent.click(botonGuardar);
    await waitFor(() => {
      expect(
        screen.getByTestId('alerta-error-cambio-clave'),
      ).toHaveTextContent(/La clave actual no es correcta/i);
    });

    // 7. Cambio exitoso
    fireEvent.click(botonGuardar);
    await waitFor(() => {
      expect(ejecutarCambio).toHaveBeenCalledWith({
        claveActual: '1600000000',
        claveNueva: 'NuevaClaveSegura1',
      });
      expect(alCambiar).toHaveBeenCalledWith(RESPUESTA_TOKEN_PRUEBA);
    });
  });
});

