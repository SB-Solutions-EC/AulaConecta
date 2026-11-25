import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servicioAcademicoConfigApi } from '../api/academicoConfigApi';
import { servicioAsistenciaApi } from '../api/asistenciaApi';
import {
  PantallaAsistencia,
  type FilaAsistencia,
} from './PantallaAsistencia';

const FILAS_BASE: ReadonlyArray<FilaAsistencia> = [
  {
    id: 'a-1',
    asignacionId: 'asig-1',
    matriculaId: 'matr-1',
    estudianteId: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    estado: 'FALTA',
    estadoPersistido: 'FALTA',
    justificacion: '',
    estadoJustificacion: null,
    confirmarCambio: false,
    version: 1,
    modificada: false,
  },
  {
    id: 'a-2',
    asignacionId: 'asig-1',
    matriculaId: 'matr-2',
    estudianteId: 'est-2',
    nombreEstudiante: 'Simulado Bruno',
    estado: 'FALTA',
    estadoPersistido: 'FALTA',
    justificacion: 'Consulta odontológica programada.',
    estadoJustificacion: 'SOLICITADA',
    confirmarCambio: false,
    version: 1,
    modificada: false,
  },
  {
    id: 'a-3',
    asignacionId: 'asig-1',
    matriculaId: 'matr-3',
    estudianteId: 'est-3',
    nombreEstudiante: 'Inventada Camila',
    estado: 'JUSTIFICADA',
    estadoPersistido: 'JUSTIFICADA',
    justificacion: 'Permiso por viaje familiar.',
    estadoJustificacion: 'APROBADA',
    confirmarCambio: false,
    version: 2,
    modificada: false,
  },
];

describe('PantallaAsistencia (RF-21: Toma rápida móvil y justificaciones)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra los contadores iniciales, filtra por búsqueda y solicitudes, y marca todos presentes en un toque', () => {
    render(<PantallaAsistencia filasIniciales={FILAS_BASE} omitirCargaRemota />);

    expect(screen.getByTestId('pantalla-asistencia')).toBeInTheDocument();
    expect(screen.getByTestId('contador-presentes')).toHaveTextContent('0');
    expect(screen.getByTestId('contador-faltas')).toHaveTextContent('2');
    expect(screen.getByTestId('contador-justificadas')).toHaveTextContent('1');

    // Filtrar solo solicitudes pendientes
    fireEvent.click(screen.getByTestId('filtro-solicitudes-justificacion'));
    expect(screen.getByTestId('tarjeta-asistencia-matr-2')).toBeInTheDocument();
    expect(
      screen.queryByTestId('tarjeta-asistencia-matr-1'),
    ).not.toBeInTheDocument();

    // Quitar filtro de solicitudes y buscar por nombre
    fireEvent.click(screen.getByTestId('filtro-solicitudes-justificacion'));
    fireEvent.change(screen.getByTestId('input-buscar-estudiante-asistencia'), {
      target: { value: 'Ana' },
    });
    expect(screen.getByTestId('tarjeta-asistencia-matr-1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('tarjeta-asistencia-matr-2'),
    ).not.toBeInTheDocument();

    // Limpiar búsqueda y marcar todos presentes
    fireEvent.change(screen.getByTestId('input-buscar-estudiante-asistencia'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('boton-todos-presentes'));

    expect(screen.getByTestId('contador-presentes')).toHaveTextContent('3');
    expect(
      screen.getByTestId('btn-estado-matr-1-PRESENTE'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('valida motivo obligatorio para JUSTIFICADA, aprueba solicitudes y rechaza fecha fuera del año lectivo', async () => {
    render(<PantallaAsistencia filasIniciales={FILAS_BASE} omitirCargaRemota />);

    // Marcar Ana como JUSTIFICADA sin motivo -> debe mostrar error al guardar
    fireEvent.click(screen.getByTestId('btn-estado-matr-1-JUSTIFICADA'));
    fireEvent.click(screen.getByTestId('boton-guardar-asistencia'));
    expect(screen.getByTestId('aviso-error-asistencia')).toHaveTextContent(
      /motivo de justificación para Simulada Ana/i,
    );

    // Ingresar motivo y también aprobar la solicitud pendiente de Bruno
    fireEvent.change(screen.getByTestId('input-justificacion-matr-1'), {
      target: { value: 'Certificado médico entregado' },
    });
    fireEvent.click(screen.getByTestId('boton-aprobar-justificacion-matr-2'));
    expect(screen.getByTestId('estado-actual-matr-2')).toHaveTextContent(
      'Justificada',
    );

    // Probar fecha fuera del año lectivo (2025-09-01 al 2026-06-30)
    fireEvent.change(screen.getByTestId('input-fecha-asistencia'), {
      target: { value: '2026-08-15' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-asistencia'));
    expect(screen.getByTestId('aviso-error-asistencia')).toHaveTextContent(
      /fuera del año lectivo/i,
    );

    // Volver a fecha válida y guardar
    fireEvent.change(screen.getByTestId('input-fecha-asistencia'), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByTestId('boton-guardar-asistencia'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito-asistencia')).toHaveTextContent(
        /2 registros actualizados/i,
      );
    });
  });

  it('exige confirmación al volver a FALTA una falta ya JUSTIFICADA y envía confirmar=true a la API', async () => {
    vi.spyOn(
      servicioAcademicoConfigApi,
      'listarAniosLectivos',
    ).mockResolvedValue([]);
    vi.spyOn(servicioAcademicoConfigApi, 'listarCursos').mockResolvedValue([]);
    vi.spyOn(servicioAcademicoConfigApi, 'listarMaterias').mockResolvedValue([]);
    vi.spyOn(servicioAsistenciaApi, 'listarAsistencias').mockResolvedValue([]);
    const guardarSpy = vi
      .spyOn(servicioAsistenciaApi, 'guardarAsistencia')
      .mockResolvedValue({
        id: 'a-3',
        asignacionId: 'asig-1',
        matriculaId: 'matr-3',
        estudianteId: 'est-3',
        nombreEstudiante: 'Inventada Camila',
        fecha: '2026-05-15',
        estado: 'FALTA',
        justificacion: null,
        estadoJustificacion: null,
        version: 3,
      });

    render(<PantallaAsistencia filasIniciales={FILAS_BASE} />);

    // Intentar marcar FALTA en Camila (ya estaba JUSTIFICADA)
    fireEvent.click(screen.getByTestId('btn-estado-matr-3-FALTA'));
    expect(screen.getByTestId('modal-confirmar-falta')).toBeInTheDocument();

    // Cancelar mantiene JUSTIFICADA
    fireEvent.click(screen.getByTestId('boton-cancelar-cambio-falta'));
    expect(
      screen.queryByTestId('modal-confirmar-falta'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('estado-actual-matr-3')).toHaveTextContent(
      'Justificada',
    );

    // Volver a intentar y confirmar
    fireEvent.click(screen.getByTestId('btn-estado-matr-3-FALTA'));
    fireEvent.click(screen.getByTestId('boton-confirmar-cambio-falta'));
    expect(screen.getByTestId('estado-actual-matr-3')).toHaveTextContent(
      'Falta',
    );

    fireEvent.click(screen.getByTestId('boton-guardar-asistencia'));

    await waitFor(() => {
      expect(guardarSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          matriculaId: 'matr-3',
          estado: 'FALTA',
          confirmar: true,
          version: 2,
        }),
      );
      expect(screen.getByTestId('aviso-exito-asistencia')).toHaveTextContent(
        /1 registro actualizado/i,
      );
    });
  });

  it('muestra motivos hostiles como texto literal sin ejecutar código (XSS)', () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const filasXss: FilaAsistencia[] = [
      {
        ...FILAS_BASE[1],
        justificacion: '<img src=x onerror=alert("xss")> <script>alert(1)</script>',
        estadoJustificacion: 'SOLICITADA',
      },
    ];

    const { container } = render(
      <PantallaAsistencia filasIniciales={filasXss} omitirCargaRemota />,
    );

    expect(container.textContent).toContain(
      '<img src=x onerror=alert("xss")> <script>alert(1)</script>',
    );
    expect(container.querySelectorAll('script, img, iframe')).toHaveLength(0);
    expect(alerta).not.toHaveBeenCalled();
  });
});
