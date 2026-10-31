import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('Esqueleto de la PWA de AulaConecta', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'UP' }),
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
          json: () => Promise.resolve({ status: 'DOWN' }),
        })
        .mockResolvedValueOnce({
          ok: true,
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

  it('permite cambiar el rol seleccionado, volver a verificar servicios y reaccionar a eventos offline/online', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });

    const botonDocente = screen.getByRole('button', { name: 'Docente' });
    fireEvent.click(botonDocente);
    expect(screen.getByText(/Rol seleccionado:/i)).toHaveTextContent('Docente');

    fireEvent(window, new Event('offline'));
    expect(screen.getByTestId('indicador-red')).toHaveTextContent(
      /Sin conexión/i,
    );

    fireEvent(window, new Event('online'));
    expect(screen.getByTestId('indicador-red')).toHaveTextContent(/En línea/i);

    const botonVerificar = screen.getByRole('button', {
      name: /Verificar servicios/i,
    });
    fireEvent.click(botonVerificar);

    await waitFor(() => {
      expect(screen.getAllByText('UP')).toHaveLength(3);
    });
  });
});
