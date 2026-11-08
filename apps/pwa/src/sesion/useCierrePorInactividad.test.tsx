import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ClienteHttp } from '../api/clienteHttp';
import {
  normalizarRolesAsignados,
  resolverRolActivo,
  ServicioAutenticacionApi,
} from '../api/autenticacionApi';
import { useCierrePorInactividad } from './useCierrePorInactividad';

const TOKEN_SIMULADO = 'aaaaaaaa';

function ComponentePruebaInactividad({
  activo,
  tiempoLimiteMs,
  alExpirar,
}: Readonly<{
  activo: boolean;
  tiempoLimiteMs: number;
  alExpirar: () => void;
}>) {
  useCierrePorInactividad({
    activo,
    tiempoLimiteMs,
    alExpirarPorInactividad: alExpirar,
  });
  return <div data-testid="detector-inactividad">Activo</div>;
}

describe('Sesión, cierre por inactividad y menú según el rol (T1106-C)', () => {
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
              id: '00000000-0000-0000-0000-000000000002',
              nombreUsuario: 'hugo.arias',
              roles: ['DOCENTE', 'REPRESENTANTE'],
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normaliza roles asignados, resuelve el rol activo y limpia el token en memoria al cerrar sesión', async () => {
    expect(normalizarRolesAsignados(undefined)).toEqual(['ESTUDIANTE']);
    expect(normalizarRolesAsignados([])).toEqual(['ESTUDIANTE']);
    expect(
      normalizarRolesAsignados(['DOCENTE', 'REPRESENTANTE', 'DOCENTE']),
    ).toEqual(['DOCENTE', 'REPRESENTANTE']);

    expect(
      resolverRolActivo(['DOCENTE', 'REPRESENTANTE'], 'REPRESENTANTE'),
    ).toBe('REPRESENTANTE');
    expect(resolverRolActivo(['DOCENTE', 'REPRESENTANTE'], 'ADMIN')).toBe(
      'DOCENTE',
    );

    const fetchFallido = vi.fn().mockRejectedValue(new Error('Sin red'));
    vi.stubGlobal('fetch', fetchFallido);

    const cliente = new ClienteHttp();
    cliente.establecerTokenAcceso(TOKEN_SIMULADO);
    const servicio = new ServicioAutenticacionApi(cliente);

    await servicio.cerrarSesion();
    expect(cliente.obtenerTokenAcceso()).toBeNull();
  });

  it('cierra la sesión automáticamente tras el tiempo de inactividad y reinicia el temporizador cuando hay eventos del usuario', () => {
    vi.useFakeTimers();
    const alExpirar = vi.fn();

    const { rerender } = render(
      <ComponentePruebaInactividad
        activo={true}
        tiempoLimiteMs={1000}
        alExpirar={alExpirar}
      />,
    );

    // A los 600 ms ocurre actividad de teclado: debe reiniciar el conteo de 1000 ms
    act(() => {
      vi.advanceTimersByTime(600);
      fireEvent.keyDown(window);
      vi.advanceTimersByTime(600);
    });
    expect(alExpirar).not.toHaveBeenCalled();

    // Completa los 400 ms restantes sin actividad -> dispara cierre
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(alExpirar).toHaveBeenCalledTimes(1);

    // Si activo es false o tiempoLimiteMs <= 0, no programa temporizador
    rerender(
      <ComponentePruebaInactividad
        activo={false}
        tiempoLimiteMs={0}
        alExpirar={alExpirar}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(alExpirar).toHaveBeenCalledTimes(1);
  });

  it('cierra la sesión desde el botón de cabecera o por inactividad en App y adapta el menú a los roles de la cuenta al iniciar sesión', async () => {
    render(<App tiempoInactividadMs={60} />);

    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });

    // Esperar a que el temporizador corto de inactividad (60 ms) cierre la sesión automáticamente
    await waitFor(() => {
      expect(screen.getByTestId('aviso-cierre-sesion')).toHaveTextContent(
        /Sesión cerrada por inactividad/i,
      );
    });

    // Iniciar sesión nuevamente con una cuenta que tiene únicamente ['DOCENTE', 'REPRESENTANTE']
    fireEvent.change(screen.getByLabelText(/Contraseña o clave inicial/i), {
      target: { value: 'aaaaaaaa' },
    });
    fireEvent.click(screen.getByTestId('boton-enviar-login'));

    await waitFor(() => {
      expect(screen.getByTestId('usuario-sesion-activa')).toHaveTextContent(
        'hugo.arias',
      );
    });

    // Verifica que solo se muestran los 2 roles asignados a hugo.arias y el menú de Docente (4 módulos)
    expect(screen.getByTestId('resumen-roles-asignados')).toHaveTextContent(
      'Roles en sesión: 2',
    );
    expect(screen.getByTestId('contador-modulos-rol')).toHaveTextContent(
      '4 módulos',
    );

    // Cierre manual de sesión desde el botón de la barra superior
    fireEvent.click(screen.getByTestId('boton-cerrar-sesion'));
    expect(screen.getByTestId('aviso-cierre-sesion')).toHaveTextContent(
      /Sesión finalizada correctamente/i,
    );
  });
});

