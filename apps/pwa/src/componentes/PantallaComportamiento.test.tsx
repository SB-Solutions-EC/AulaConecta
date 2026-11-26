import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servicioAcademicoConfigApi } from '../api/academicoConfigApi';
import {
  servicioComportamientoApi,
  type ClaveIndicadorComportamiento,
  type EscalaComportamiento,
} from '../api/comportamientoApi';
import {
  INDICADORES_COMPORTAMIENTO,
  PantallaComportamiento,
  calcularComportamiento,
  type FilaComportamiento,
} from './PantallaComportamiento';

function llenarTodos(
  escala: EscalaComportamiento,
): Record<ClaveIndicadorComportamiento, EscalaComportamiento> {
  const resultado = {} as Record<
    ClaveIndicadorComportamiento,
    EscalaComportamiento
  >;
  for (const ind of INDICADORES_COMPORTAMIENTO) {
    resultado[ind.clave] = escala;
  }
  return resultado;
}

const FILAS_BASE: ReadonlyArray<FilaComportamiento> = [
  {
    id: 'c-1',
    matriculaId: 'matr-1',
    estudianteId: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    indicadores: llenarTodos('SIEMPRE'),
    version: 1,
    modificada: false,
  },
  {
    id: 'c-2',
    matriculaId: 'matr-2',
    estudianteId: 'est-2',
    nombreEstudiante: 'Inventada Camila',
    indicadores: {
      cog1: 'FRECUENTEMENTE',
      cog2: 'FRECUENTEMENTE',
      cog3: 'SIEMPRE',
      soc1: 'FRECUENTEMENTE',
    },
    version: 0,
    modificada: false,
  },
];

describe('PantallaComportamiento (RF-22: 9 indicadores cognitivos y sociales)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calcula correctamente los tramos A, B, C, D, E y estado sin evaluar', () => {
    expect(calcularComportamiento({}).nota).toBeNull();
    expect(calcularComportamiento(llenarTodos('SIEMPRE'))).toMatchObject({
      completados: 9,
      completo: true,
      nota: 10,
      cualitativo: 'A',
      etiqueta: 'Muy satisfactorio',
    });
    expect(calcularComportamiento(llenarTodos('FRECUENTEMENTE'))).toMatchObject({
      nota: 8,
      cualitativo: 'B',
      etiqueta: 'Satisfactorio',
    });
    expect(calcularComportamiento(llenarTodos('OCASIONALMENTE'))).toMatchObject({
      nota: 6,
      cualitativo: 'C',
      etiqueta: 'Poco satisfactorio',
    });
    expect(
      calcularComportamiento({
        ...llenarTodos('OCASIONALMENTE'),
        soc1: 'NUNCA',
        soc2: 'NUNCA',
        soc3: 'NUNCA',
        soc4: 'NUNCA',
      }),
    ).toMatchObject({
      nota: 4.22,
      cualitativo: 'D',
      etiqueta: 'Mejorable',
    });
    expect(calcularComportamiento(llenarTodos('NUNCA'))).toMatchObject({
      nota: 2,
      cualitativo: 'E',
      etiqueta: 'Insatisfactorio',
    });
  });

  it('renderiza los 9 indicadores, filtra estudiantes y valida evaluación incompleta antes de guardar', () => {
    render(
      <PantallaComportamiento filasIniciales={FILAS_BASE} omitirCargaRemota />,
    );

    expect(screen.getByTestId('pantalla-comportamiento')).toBeInTheDocument();
    expect(screen.getByTestId('resumen-comportamiento')).toHaveTextContent(
      '1 / 2',
    );
    expect(
      screen.getByTestId('resultado-comportamiento-actual'),
    ).toHaveTextContent('A · Muy satisfactorio');

    // Buscar y seleccionar a Camila (incompleta)
    fireEvent.change(
      screen.getByTestId('input-buscar-estudiante-comportamiento'),
      {
        target: { value: 'Camila' },
      },
    );
    expect(
      screen.queryByTestId('tarjeta-comportamiento-matr-1'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tarjeta-comportamiento-matr-2'));
    fireEvent.click(screen.getByTestId('boton-guardar-comportamiento'));

    expect(screen.getByTestId('aviso-error-comportamiento')).toHaveTextContent(
      /Completa los 9 indicadores.*Inventada Camila.*\(4\/9\)/i,
    );
  });

  it('recalcula en vivo al completar indicadores, soporta "Marcar todos Siempre" y guarda vía API', async () => {
    vi.spyOn(servicioAcademicoConfigApi, 'listarCursos').mockResolvedValue([]);
    vi.spyOn(
      servicioComportamientoApi,
      'listarComportamientos',
    ).mockResolvedValue([]);
    const guardarSpy = vi
      .spyOn(servicioComportamientoApi, 'guardarComportamiento')
      .mockResolvedValue({
        id: 'c-2',
        matriculaId: 'matr-2',
        estudianteId: 'est-2',
        nombreEstudiante: 'Inventada Camila',
        trimestre: 1,
        indicadores: llenarTodos('SIEMPRE'),
        nota: 10,
        cualitativo: 'A',
        version: 1,
      });

    render(<PantallaComportamiento filasIniciales={FILAS_BASE} />);

    fireEvent.click(screen.getByTestId('tarjeta-comportamiento-matr-2'));
    fireEvent.click(screen.getByTestId('ind-cog4-OCASIONALMENTE'));
    expect(
      screen.getByTestId('ind-cog4-OCASIONALMENTE'),
    ).toHaveAttribute('aria-pressed', 'true');

    // Aplicar todos "Siempre" para completar los 9 indicadores
    fireEvent.click(screen.getByTestId('boton-aplicar-siempre'));
    expect(
      screen.getByTestId('resultado-comportamiento-actual'),
    ).toHaveTextContent('10.00 / 10');
    expect(
      screen.getByTestId('resultado-comportamiento-actual'),
    ).toHaveTextContent(
      'Lidera el cumplimiento de los compromisos establecidos para la sana convivencia social.',
    );

    fireEvent.click(screen.getByTestId('boton-guardar-comportamiento'));

    await waitFor(() => {
      expect(guardarSpy).toHaveBeenCalledWith({
        id: 'c-2',
        matriculaId: 'matr-2',
        trimestre: 1,
        indicadores: llenarTodos('SIEMPRE'),
        version: 0,
      });
      expect(
        screen.getByTestId('aviso-exito-comportamiento'),
      ).toHaveTextContent(/guardado con cualitativo A \(10\.00\)/i);
    });
  });
});
