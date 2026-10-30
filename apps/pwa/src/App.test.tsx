import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('Esqueleto de la PWA de AulaConecta', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'UP' }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la identidad de la Unidad Educativa Andoas y los 3 microservicios en estado UP', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /AulaConecta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unidad Educativa “Andoas”/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      const estadosUp = screen.getAllByText('UP');
      expect(estadosUp).toHaveLength(3);
    });

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

  it('marca el servicio como DOWN cuando la petición a /health falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Error de red')),
    );

    render(<App />);

    await waitFor(() => {
      const estadosDown = screen.getAllByText('DOWN');
      expect(estadosDown).toHaveLength(3);
    });
  });
});

