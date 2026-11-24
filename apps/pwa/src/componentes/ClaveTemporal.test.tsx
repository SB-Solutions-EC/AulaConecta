import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorHttpApi, type ClienteHttp } from '../api/clienteHttp';
import { ServicioCuentasApi } from '../api/cuentasApi';
import { BotonClaveTemporal, TarjetaClaveTemporal } from './ClaveTemporal';

// Clave temporal de un solo uso (RF-03 v1.1, CR-02). Valor ficticio, el mismo ejemplo del contrato.
const CREDENCIALES = {
  nombreUsuario: 'luis.mora',
  claveTemporal: 'Tq7mPz3RkW',
  claveTemporalVence: '2026-11-19T18:00:00Z',
};

describe('Clave temporal (RF-03 v1.1, CR-02)', () => {
  it('ServicioCuentasApi pide otra clave temporal a ms-identidad', async () => {
    const http = {
      post: vi.fn().mockResolvedValue({ id: 'u-1', ...CREDENCIALES, roles: ['DOCENTE'] }),
    } as unknown as ClienteHttp;

    const credenciales = await new ServicioCuentasApi(http).generarClaveTemporal('u-1');

    expect(http.post).toHaveBeenCalledWith('/api/identidad/usuarios/u-1/clave-temporal');
    expect(credenciales).toEqual(CREDENCIALES);
  });

  it('ServicioCuentasApi falla si la respuesta no trae la clave', async () => {
    const http = { post: vi.fn().mockResolvedValue({ nombreUsuario: 'luis.mora' }) } as unknown as ClienteHttp;

    await expect(new ServicioCuentasApi(http).generarClaveTemporal('u-1')).rejects.toThrow(
      /no devolvió la clave temporal/,
    );
  });

  it('la tarjeta muestra usuario, clave y aviso de un solo uso, y se puede ocultar', () => {
    const alCerrar = vi.fn();
    render(<TarjetaClaveTemporal titulo="Clave de Luis" credenciales={CREDENCIALES} alCerrar={alCerrar} />);

    expect(screen.getByTestId('tarjeta-clave-temporal')).toHaveTextContent(/luis\.mora.*Tq7mPz3RkW.*No se volverá a mostrar/);
    fireEvent.click(screen.getByRole('button', { name: /Ocultar la clave temporal/i }));
    expect(alCerrar).toHaveBeenCalled();
  });

  it('el botón genera otra clave y la muestra; si ms-identidad la rechaza, muestra el motivo', async () => {
    const servicio = {
      generarClaveTemporal: vi
        .fn()
        .mockResolvedValueOnce(CREDENCIALES)
        .mockRejectedValueOnce(new ErrorHttpApi(409, 'CUENTA_INACTIVA', 'La cuenta está inactiva.')),
    };
    render(<BotonClaveTemporal usuarioId="u-1" nombrePersona="Luis Mora" servicio={servicio} />);

    const boton = screen.getByRole('button', { name: /Generar otra clave temporal para Luis Mora/i });
    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.getByTestId('valor-clave-temporal')).toHaveTextContent('Tq7mPz3RkW');
    });
    expect(servicio.generarClaveTemporal).toHaveBeenCalledWith('u-1');

    fireEvent.click(screen.getByRole('button', { name: /Ocultar la clave temporal/i }));
    expect(screen.queryByTestId('tarjeta-clave-temporal')).not.toBeInTheDocument();

    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('La cuenta está inactiva.');
    });
  });
});
