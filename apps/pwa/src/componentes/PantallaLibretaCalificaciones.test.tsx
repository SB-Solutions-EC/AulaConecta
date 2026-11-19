import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servicioCalificacionesApi } from '../api/calificacionesApi';
import { PantallaLibretaCalificaciones } from './PantallaLibretaCalificaciones';

describe('PantallaLibretaCalificaciones (RF-17, RF-18)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra la libreta con bloques, refuerzo, proyecto, examen y recalcula en vivo', () => {
    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    expect(screen.getByTestId('nota-final-est-1')).toHaveTextContent('9.00');
    expect(screen.getByTestId('cualitativo-est-1')).toHaveTextContent('A-');
    expect(screen.getByTestId('alerta-promedio-bajo-est-3')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Simulada Ana - Examen'), {
      target: { value: '10' },
    });

    expect(screen.getByTestId('nota-final-est-1')).toHaveTextContent('9.15');
    expect(screen.getByTestId('boton-guardar-libreta')).toHaveTextContent(
      'Guardar libreta (1)',
    );
  });

  it('valida notas fuera de rango (0 a 10) y bloquea el guardado hasta corregir', () => {
    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    const inputDeberes = screen.getByLabelText('Simulada Ana - Deberes');
    fireEvent.change(inputDeberes, { target: { value: '12' } });

    expect(screen.getByTestId('aviso-error-validacion')).toBeInTheDocument();
    expect(inputDeberes).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('boton-guardar-libreta')).toBeDisabled();

    fireEvent.change(inputDeberes, { target: { value: '9.0' } });
    expect(
      screen.queryByTestId('aviso-error-validacion'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('boton-guardar-libreta')).not.toBeDisabled();
  });

  it('bloquea la edición y guardado cuando el trimestre está cerrado (RN-18)', () => {
    render(
      <PantallaLibretaCalificaciones
        omitirCargaRemota
        periodosIniciales={[
          {
            id: 'per-cerrado',
            anioLectivoId: 'demo-anio-1',
            numero: 1,
            inicio: '2025-09-01',
            fin: '2025-11-30',
            cerrado: true,
            version: 1,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('aviso-trimestre-cerrado')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulada Ana - Examen')).toBeDisabled();
    expect(screen.getByTestId('boton-guardar-libreta')).toBeDisabled();
  });

  it('filtra estudiantes y abre el modal de libreta individual', () => {
    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    fireEvent.change(screen.getByTestId('filtro-busqueda-estudiante'), {
      target: { value: 'Camila' },
    });

    expect(screen.queryByText('Simulada Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Inventado Camila')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('boton-ver-libreta-est-3'));
    expect(screen.getByTestId('modal-libreta-individual')).toBeInTheDocument();
    expect(screen.getByTestId('detalle-nota-final')).toHaveTextContent('5.79');

    fireEvent.click(screen.getByRole('button', { name: /Cerrar libreta$/i }));
    expect(
      screen.queryByTestId('modal-libreta-individual'),
    ).not.toBeInTheDocument();
  });

  it('envía las filas modificadas al guardar la libreta', async () => {
    const guardarLoteSpy = vi
      .spyOn(servicioCalificacionesApi, 'guardarLote')
      .mockResolvedValue([
        {
          id: 'reg-1',
          matriculaId: 'matr-1',
          estudianteId: 'est-1',
          nombreEstudiante: 'Simulada Ana',
          materiaId: 'demo-mat-1',
          periodoId: 'demo-per-1',
          bloque1: [9, 8.5, 9, 8.5, 9],
          bloque2: [9, 9, 8.5, 9, 9.5],
          refuerzo: null,
          proyecto: 9.5,
          examen: 10,
          version: 2,
        },
      ]);

    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    fireEvent.change(screen.getByLabelText('Simulada Ana - Examen'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-libreta'));

    await waitFor(() => {
      expect(guardarLoteSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('aviso-guardado-exitoso')).toHaveTextContent(
        /Libreta guardada correctamente/i,
      );
    });
  });
});
