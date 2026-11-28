import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  servicioAuditoriaNotasApi,
  type RegistroAuditoriaAcademica,
} from '../api/auditoriaNotasApi';
import {
  ModalHistorialNota,
  extraerDiferenciasNota,
} from './ModalHistorialNota';
import { PantallaLibretaCalificaciones } from './PantallaLibretaCalificaciones';

describe('ModalHistorialNota y extraerDiferenciasNota (RNF-09)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extrae diferencias solo de los campos creados o modificados, incluyendo arreglos', () => {
    const creacion = extraerDiferenciasNota(null, {
      notaFinal: 8.5,
      cualitativo: 'B+',
      aportesBloque1: [8, 9],
    });
    expect(creacion).toEqual([
      { campo: 'notaFinal', etiqueta: 'Nota final', anterior: '—', nuevo: '8.50' },
      { campo: 'cualitativo', etiqueta: 'Cualitativo', anterior: '—', nuevo: 'B+' },
      {
        campo: 'aportesBloque1',
        etiqueta: 'Aportes Bloque 1',
        anterior: '—',
        nuevo: '8, 9',
      },
    ]);

    const actualizacion = extraerDiferenciasNota(
      { notaFinal: 8.5, cualitativo: 'B+', notaExamen: 8 },
      { notaFinal: 9.0, cualitativo: 'B+', notaExamen: 9.5 },
    );
    expect(actualizacion).toEqual([
      { campo: 'notaFinal', etiqueta: 'Nota final', anterior: '8.50', nuevo: '9' },
      {
        campo: 'notaExamen',
        etiqueta: 'Examen trimestral',
        anterior: '8',
        nuevo: '9.50',
      },
    ]);
  });

  it('se integra en PantallaLibretaCalificaciones, filtra eventos por acción y cierra el modal', () => {
    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    fireEvent.click(screen.getByTestId('boton-historial-est-1'));
    const modal = screen.getByTestId('modal-historial-nota');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('Simulada Ana');
    expect(modal).toHaveTextContent('Carlos Docente');
    expect(modal).toHaveTextContent('8.50');
    expect(modal).toHaveTextContent('9');

    // Filtrar solo actualizaciones (UPDATE)
    fireEvent.change(screen.getByTestId('filtro-accion-historial'), {
      target: { value: 'UPDATE' },
    });
    expect(screen.getAllByTestId(/^evento-historial-/)).toHaveLength(1);
    expect(modal).toHaveTextContent('Actualización');

    // Filtrar solo registro inicial (CREATE)
    fireEvent.change(screen.getByTestId('filtro-accion-historial'), {
      target: { value: 'CREATE' },
    });
    expect(screen.getAllByTestId(/^evento-historial-/)).toHaveLength(1);
    expect(modal).toHaveTextContent('Registro inicial');

    fireEvent.click(
      screen.getByRole('button', { name: /Cerrar historial de cambios/i }),
    );
    expect(screen.queryByTestId('modal-historial-nota')).not.toBeInTheDocument();
  });

  it('también permite abrir el historial desde el modal de libreta individual', () => {
    render(<PantallaLibretaCalificaciones omitirCargaRemota />);

    fireEvent.click(screen.getByTestId('boton-ver-libreta-est-2'));
    expect(screen.getByTestId('modal-libreta-individual')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('boton-historial-desde-libreta'));
    expect(
      screen.queryByTestId('modal-libreta-individual'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-historial-nota')).toHaveTextContent(
      'Simulada Bruno',
    );
  });

  it('carga el historial remoto desde /auditoria y muestra contenido hostil como texto literal (XSS)', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const remotos: RegistroAuditoriaAcademica[] = [
      {
        id: 'aud-remoto-1',
        entidad: 'CALIFICACION',
        entidadId: 'cal-1',
        accion: 'UPDATE',
        valorAnterior: { notaFinal: 6.5 },
        valorNuevo: { notaFinal: 7.25 },
        usuarioId: 'usr-1',
        nombreUsuario: '<script>alert("xss")</script> Prof. Lucía',
        ocurridoEn: '2026-11-28T10:15:00Z',
      },
    ];
    const spy = vi
      .spyOn(servicioAuditoriaNotasApi, 'listarHistorialNota')
      .mockResolvedValue(remotos);

    const { container } = render(
      <ModalHistorialNota
        entidadId="cal-1"
        nombreEstudiante="Simulada Ana"
        nombreMateria="MAT – Matemática"
        trimestre={1}
        alCerrar={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('cal-1');
      expect(screen.getByTestId('evento-historial-aud-remoto-1')).toHaveTextContent(
        '6.50',
      );
      expect(screen.getByTestId('evento-historial-aud-remoto-1')).toHaveTextContent(
        '7.25',
      );
      expect(container.textContent).toContain('<script>alert("xss")</script> Prof. Lucía');
    });

    expect(container.querySelectorAll('script, img, iframe')).toHaveLength(0);
    expect(alerta).not.toHaveBeenCalled();
  });
});
