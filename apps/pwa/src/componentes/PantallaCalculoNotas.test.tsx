import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PantallaCalculoNotas } from './PantallaCalculoNotas';

describe('PantallaCalculoNotas (T1117-C)', () => {
  it('muestra cálculo inmediato al editar aportes, refuerzo, proyecto y examen', () => {
    render(<PantallaCalculoNotas />);

    // Fila 1 inicial (Simulada Ana)
    expect(screen.getByTestId('nota-final-est-1')).toHaveTextContent('9.00');
    expect(screen.getByTestId('cualitativo-est-1')).toHaveTextContent('A-');

    // Fila 3 inicial (Inventado Camila) por debajo de 7,00 muestra alerta RF-30
    expect(screen.getByTestId('alerta-promedio-bajo-est-3')).toBeInTheDocument();

    // Editar examen de Simulada Ana a 10 para recalcular inmediatamente
    fireEvent.change(screen.getByLabelText('Simulada Ana - Examen'), {
      target: { value: '10' },
    });

    expect(screen.getByTestId('nota-final-est-1')).toHaveTextContent('9.15');

    // Aplicar refuerzo de 9.5 a Inventado Camila para subir su nota y quitar la alerta < 7,00
    fireEvent.change(screen.getByLabelText('Inventado Camila - Refuerzo'), {
      target: { value: '9.5' },
    });

    expect(
      screen.queryByTestId('alerta-promedio-bajo-est-3'),
    ).not.toBeInTheDocument();
  });

  it('permite agregar una nueva fila de cálculo y calcular desde cero', () => {
    render(<PantallaCalculoNotas />);

    fireEvent.change(screen.getByLabelText(/Nombre de nuevo estudiante/i), {
      target: { value: 'Prueba Lucía' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Agregar fila de cálculo/i }),
    );

    expect(screen.getByText('Prueba Lucía')).toBeInTheDocument();
    expect(screen.getByTestId('nota-final-est-nuevo-4')).toHaveTextContent('—');

    fireEvent.change(screen.getByLabelText('Prueba Lucía - Deberes'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText('Prueba Lucía - Trabajos en clase'), {
      target: { value: '9' },
    });
    fireEvent.change(screen.getByLabelText('Prueba Lucía - Proyecto'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText('Prueba Lucía - Examen'), {
      target: { value: '8' },
    });

    expect(screen.getByTestId('nota-final-est-nuevo-4')).toHaveTextContent('8.35');
    expect(screen.getByTestId('cualitativo-est-nuevo-4')).toHaveTextContent('B+');
  });
});
