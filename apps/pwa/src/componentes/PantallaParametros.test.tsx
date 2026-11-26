import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servicioParametrosApi } from '../api/parametrosApi';
import {
  CLAVE_PONDERACIONES,
  PantallaParametros,
  simularNotaConPonderaciones,
} from './PantallaParametros';

describe('PantallaParametros (RNF-10: Parámetros configurables del colegio)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calcula correctamente la simulación de notas con distintas ponderaciones', () => {
    expect(
      simularNotaConPonderaciones({
        aportes: 8,
        proyecto: 10,
        examen: 9,
        pctAportes: 70,
        pctProyecto: 15,
        pctExamen: 15,
      }),
    ).toBe(8.45);

    expect(
      simularNotaConPonderaciones({
        aportes: 8,
        proyecto: 10,
        examen: 9,
        pctAportes: 60,
        pctProyecto: 20,
        pctExamen: 20,
      }),
    ).toBe(8.6);
  });

  it('valida que las ponderaciones sumen 100 %, recalcula el simulador y guarda vía API', async () => {
    vi.spyOn(servicioParametrosApi, 'listarParametros').mockResolvedValue([
      {
        id: 'par-1',
        clave: CLAVE_PONDERACIONES,
        valor: { aportes: 70, proyecto: 15, examen: 15, minimoAprobacion: 7 },
        version: 3,
      },
    ]);
    const actualizarSpy = vi
      .spyOn(servicioParametrosApi, 'actualizarParametro')
      .mockResolvedValue({
        id: 'par-1',
        clave: CLAVE_PONDERACIONES,
        valor: { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 },
        version: 4,
      });

    render(<PantallaParametros />);

    await waitFor(() => {
      expect(
        screen.getByTestId('version-parametro-ponderaciones'),
      ).toHaveTextContent('v3');
    });

    expect(screen.getByTestId('simulador-ponderaciones')).toHaveTextContent(
      '8.45',
    );

    // Cambiar solo aportes a 60 (suma 90 %) -> error al guardar
    fireEvent.change(screen.getByTestId('input-ponderacion-aportes'), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-ponderaciones'));
    expect(screen.getByTestId('aviso-error-parametros')).toHaveTextContent(
      /sumar exactamente 100 %/i,
    );

    // Completar proyecto 20 % y examen 20 % -> simulador cambia a 8.60 y guarda
    fireEvent.change(screen.getByTestId('input-ponderacion-proyecto'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByTestId('input-ponderacion-examen'), {
      target: { value: '20' },
    });
    expect(screen.getByTestId('simulador-ponderaciones')).toHaveTextContent(
      '8.60',
    );

    fireEvent.click(screen.getByTestId('boton-guardar-ponderaciones'));

    await waitFor(() => {
      expect(actualizarSpy).toHaveBeenCalledWith({
        clave: CLAVE_PONDERACIONES,
        valor: { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 },
        version: 3,
      });
      expect(screen.getByTestId('aviso-exito-parametros')).toHaveTextContent(
        /60% \/ 20% \/ 20%/i,
      );
    });
  });

  it('valida orden descendente en escalas cualitativas, textos de comportamiento y permite restaurar valores', async () => {
    render(<PantallaParametros omitirCargaRemota />);

    // Escalas cualitativas
    fireEvent.click(screen.getByTestId('tab-escalas'));
    fireEvent.change(screen.getByTestId('input-escala-min-AA'), {
      target: { value: '9.50' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-escalas'));
    expect(screen.getByTestId('aviso-error-parametros')).toHaveTextContent(
      /orden estrictamente descendente/i,
    );

    fireEvent.change(screen.getByTestId('input-escala-min-AA'), {
      target: { value: '7.50' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-escalas'));
    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito-parametros')).toHaveTextContent(
        /Escalas cualitativas actualizadas/i,
      );
    });

    // Textos de comportamiento
    fireEvent.click(screen.getByTestId('tab-textos'));
    fireEvent.change(screen.getByTestId('input-texto-etiqueta-A'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-textos'));
    expect(screen.getByTestId('aviso-error-parametros')).toHaveTextContent(
      /etiqueta y descripción del nivel A/i,
    );

    fireEvent.change(screen.getByTestId('input-texto-etiqueta-A'), {
      target: { value: 'Sobresaliente' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-textos'));
    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito-parametros')).toHaveTextContent(
        /Textos de comportamiento actualizados/i,
      );
    });

    // Restaurar valores por defecto
    fireEvent.click(screen.getByTestId('boton-restaurar-parametros'));
    expect(screen.getByTestId('input-texto-etiqueta-A')).toHaveValue(
      'Muy satisfactorio',
    );
  });
});
