import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  obtenerModulosPorRol,
  tienePermisoRuta,
} from './rutas/rutasProtegidas';

// Cédula ficticia con provincia 99 (no existe en Ecuador) para no activar la regla cedula-ecuador de Gitleaks
const CLAVE_INICIAL_FICTICIA = '9900000001';
const CLAVE_PERSONAL_PRUEBA = 'aaaaaaaa';
const TOKEN_SIMULADO = 'aaaaaaaa';

describe('Layout por rol, rutas protegidas y estado de la PWA de AulaConecta', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'UP',
            accessToken: TOKEN_SIMULADO,
            tokenType: 'Bearer',
            expiresIn: 900,
            usuario: {
              id: '00000000-0000-0000-0000-000000000001',
              nombreUsuario: 'ana.perez',
              roles: ['ADMIN'],
              debeCambiarClave: false,
              estado: 'ACTIVO',
              intentosFallidos: 0,
              version: 1,
            },
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la identidad de la Unidad Educativa Andoas y los 3 microservicios en estado UP', async () => {
    render(<App />);

    await waitFor(() => {
      const estadosUp = screen.getAllByText('UP');
      expect(estadosUp).toHaveLength(3);
    });

    expect(
      screen.getByRole('heading', { name: 'AulaConecta', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unidad Educativa “Andoas” · Puyo, Pastaza/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/AulaConecta v0\.1\.0 · SB Solutions/i),
    ).toBeInTheDocument();

    expect(screen.getByTestId('tarjeta-ms-identidad')).toHaveTextContent(
      '/api/identidad/health',
    );
    expect(screen.getByTestId('tarjeta-ms-academico')).toHaveTextContent(
      '/api/academico/health',
    );
    expect(screen.getByTestId('tarjeta-ms-notificaciones')).toHaveTextContent(
      '/api/notificaciones/health',
    );
  });

  it('marca el servicio como DOWN cuando la petición a /health falla o devuelve HTTP no exitoso', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ status: 'DOWN' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'DOWN' }),
        })
        .mockRejectedValueOnce(new Error('Error de red')),
    );

    render(<App />);

    await waitFor(() => {
      const estadosDown = screen.getAllByText('DOWN');
      expect(estadosDown).toHaveLength(3);
    });
  });

  it('filtra el menú lateral según el rol seleccionado y navega entre rutas protegidas o restringidas (403)', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });

    // Como ADMIN ve Configuración académica y puede navegar a ella
    const itemConfig = screen.getByTestId('nav-item-configuracion-academica');
    fireEvent.click(itemConfig);
    expect(
      screen.getByTestId('vista-modulo-configuracion-academica'),
    ).toBeInTheDocument();

    // Si cambia al rol Docente mientras está en /configuracion-academica, RutaProtegida bloquea con 403
    const botonDocente = screen.getByRole('button', { name: 'Docente' });
    fireEvent.click(botonDocente);

    expect(screen.getByTestId('vista-acceso-denegado')).toHaveTextContent(
      /Sin permisos para Configuración académica/i,
    );

    // El botón "Volver al panel principal" regresa a /panel
    fireEvent.click(
      screen.getByRole('button', { name: /Volver al panel principal/i }),
    );
    expect(screen.getByTestId('tarjeta-ms-identidad')).toBeInTheDocument();

    // Verifica que el menú lateral de Docente incluye Calificaciones y asistencia
    fireEvent.click(screen.getByTestId('nav-item-calificaciones-asistencia'));
    expect(
      screen.getByTestId('vista-modulo-calificaciones-asistencia'),
    ).toBeInTheDocument();

    // Verifica funciones utilitarias de permisos por ruta
    expect(obtenerModulosPorRol('ESTUDIANTE').map((m) => m.ruta)).toEqual([
      '/panel',
      '/seguimiento',
    ]);
    expect(tienePermisoRuta('SECRETARIA', '/matriculas')).toBe(true);
    expect(tienePermisoRuta('ESTUDIANTE', '/auditoria')).toBe(false);
    expect(tienePermisoRuta('ADMIN', '/ruta-inexistente')).toBe(false);
  });

  it('integra las pantallas de cambio obligatorio de clave inicial (RF-03) e inicio de sesión dentro de RutaProtegida', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });

    // Alternar menú móvil
    const botonMenuMovil = screen.getByRole('button', {
      name: /Abrir menú lateral/i,
    });
    fireEvent.click(botonMenuMovil);
    expect(
      screen.getByRole('button', { name: /Cerrar menú lateral/i }),
    ).toBeInTheDocument();

    // Activar vista de cambio obligatorio de clave inicial (debeCambiarClave = true)
    fireEvent.click(screen.getByTestId('toggle-cambio-clave'));
    expect(
      screen.getByTestId('vista-cambio-clave-obligatorio'),
    ).toBeInTheDocument();

    // Completar el formulario de cambio de clave inicial
    fireEvent.change(screen.getByLabelText(/Clave actual/i), {
      target: { value: CLAVE_INICIAL_FICTICIA },
    });
    fireEvent.change(
      screen.getByLabelText(/Nueva contraseña \(mín\. 8 caracteres\)/i),
      {
        target: { value: CLAVE_PERSONAL_PRUEBA },
      },
    );
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
      target: { value: CLAVE_PERSONAL_PRUEBA },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-cambio-clave'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('vista-cambio-clave-obligatorio'),
      ).not.toBeInTheDocument();
    });

    // Activar pantalla de inicio de sesión (no autenticado)
    fireEvent.click(screen.getByTestId('toggle-sesion'));
    expect(screen.getByTestId('vista-no-autenticado')).toBeInTheDocument();
    expect(screen.getByTestId('pantalla-inicio-sesion')).toBeInTheDocument();

    // Volver al panel desde la pantalla de inicio de sesión
    fireEvent.click(
      screen.getByRole('button', { name: /Volver al panel demostrativo/i }),
    );
    expect(
      screen.queryByTestId('vista-no-autenticado'),
    ).not.toBeInTheDocument();

    // Eventos offline y online + reverificación de servicios
    fireEvent(window, new Event('offline'));
    expect(screen.getByTestId('indicador-red')).toHaveTextContent(
      /Sin conexión/i,
    );

    fireEvent(window, new Event('online'));
    expect(screen.getByTestId('indicador-red')).toHaveTextContent(/En línea/i);

    fireEvent.click(
      screen.getByRole('button', { name: /Verificar servicios/i }),
    );
    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });
  });
});
