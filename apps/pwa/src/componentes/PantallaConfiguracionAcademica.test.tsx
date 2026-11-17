import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ServicioAcademicoConfigApi,
  type AnioLectivo,
  type Curso,
  type Materia,
  type Periodo,
} from '../api/academicoConfigApi';
import { ClienteHttp, ErrorHttpApi } from '../api/clienteHttp';
import { PantallaConfiguracionAcademica } from './PantallaConfiguracionAcademica';

const ANIO_INICIAL: AnioLectivo = {
  id: '11111111-1111-1111-1111-111111111111',
  nombre: '2026-2027',
  inicio: '2026-09-01',
  fin: '2027-06-30',
  activo: true,
  version: 0,
};

const TRIMESTRE_INICIAL: Periodo = {
  id: '22222222-2222-2222-2222-222222222222',
  anioLectivoId: ANIO_INICIAL.id,
  numero: 1,
  inicio: '2026-09-01',
  fin: '2026-11-30',
  cerrado: false,
  version: 0,
};

const CURSO_INICIAL: Curso = {
  id: '33333333-3333-3333-3333-333333333333',
  anioLectivoId: ANIO_INICIAL.id,
  nivel: '9no EGB',
  paralelo: 'A',
  version: 0,
};

const MATERIA_INICIAL: Materia = {
  id: '44444444-4444-4444-4444-444444444444',
  codigo: 'MAT',
  nombre: 'Matemática',
  area: 'Matemática',
  version: 0,
};

describe('Pantallas de configuración académica (T1109-C, RF-06, RF-07)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ServicioAcademicoConfigApi consulta y crea años lectivos, trimestres, cursos y materias', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([ANIO_INICIAL]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(ANIO_INICIAL),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([TRIMESTRE_INICIAL]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(TRIMESTRE_INICIAL),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([CURSO_INICIAL]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(CURSO_INICIAL),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([MATERIA_INICIAL]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(MATERIA_INICIAL),
      });
    vi.stubGlobal('fetch', fetchMock);

    const cliente = new ClienteHttp();
    cliente.establecerTokenAcceso('aaaaaaaa');
    const servicio = new ServicioAcademicoConfigApi(cliente);

    expect(await servicio.listarAniosLectivos()).toEqual([ANIO_INICIAL]);
    await servicio.crearAnioLectivo({
      nombre: ' 2026-2027 ',
      inicio: '2026-09-01',
      fin: '2027-06-30',
    });
    expect(await servicio.listarPeriodos(ANIO_INICIAL.id)).toEqual([
      TRIMESTRE_INICIAL,
    ]);
    await servicio.crearPeriodo({
      anioLectivoId: ANIO_INICIAL.id,
      numero: 1,
      inicio: '2026-09-01',
      fin: '2026-11-30',
    });
    expect(await servicio.listarCursos(ANIO_INICIAL.id)).toEqual([
      CURSO_INICIAL,
    ]);
    await servicio.crearCurso({
      anioLectivoId: ANIO_INICIAL.id,
      nivel: ' 9no EGB ',
      paralelo: ' a ',
    });
    expect(await servicio.listarMaterias()).toEqual([MATERIA_INICIAL]);
    await servicio.crearMateria({
      codigo: ' mat ',
      nombre: ' Matemática ',
      area: '  ',
    });

    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      `/api/academico/periodos?anioLectivoId=${ANIO_INICIAL.id}`,
    );
    // La materia va con el código en mayúsculas y sin área vacía
    expect(JSON.parse(String(fetchMock.mock.calls[7][1].body))).toEqual({
      codigo: 'MAT',
      nombre: 'Matemática',
    });
  });

  it('valida y permite crear años lectivos, trimestres, cursos con paralelos y materias', async () => {
    const servicioMock = {
      listarAniosLectivos: vi.fn().mockResolvedValue([ANIO_INICIAL]),
      crearAnioLectivo: vi.fn().mockResolvedValue({
        ...ANIO_INICIAL,
        id: '55555555-5555-5555-5555-555555555555',
        nombre: '2027-2028',
        activo: false,
      }),
      listarPeriodos: vi.fn().mockResolvedValue([TRIMESTRE_INICIAL]),
      crearPeriodo: vi.fn().mockResolvedValue({
        ...TRIMESTRE_INICIAL,
        id: '66666666-6666-6666-6666-666666666666',
        numero: 2,
        inicio: '2026-12-01',
        fin: '2027-02-28',
      }),
      listarCursos: vi.fn().mockResolvedValue([CURSO_INICIAL]),
      crearCurso: vi.fn().mockResolvedValue({
        ...CURSO_INICIAL,
        id: '77777777-7777-7777-7777-777777777777',
        nivel: '10mo EGB',
        paralelo: 'B',
      }),
      listarMaterias: vi.fn().mockResolvedValue([MATERIA_INICIAL]),
      crearMateria: vi.fn().mockResolvedValue({
        ...MATERIA_INICIAL,
        id: '88888888-8888-8888-8888-888888888888',
        codigo: 'LEN',
        nombre: 'Lengua y Literatura',
        area: 'Comunicación',
      }),
    };

    render(<PantallaConfiguracionAcademica servicio={servicioMock} />);

    await waitFor(() => {
      expect(screen.getByTestId('lista-anios-lectivos')).toHaveTextContent(
        '2026-2027',
      );
    });
    expect(screen.getByTestId('lista-trimestres')).toHaveTextContent(
      'Trimestre 1',
    );

    // Validación de campos vacíos en año lectivo
    fireEvent.click(screen.getByTestId('boton-crear-anio'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /Complete el nombre y las fechas/i,
    );

    // Validación fecha de fin menor o igual a inicio
    fireEvent.change(screen.getByLabelText(/Nombre del año lectivo/i), {
      target: { value: '2027-2028' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de inicio/i), {
      target: { value: '2027-09-01' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de fin/i), {
      target: { value: '2027-08-01' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-anio'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /debe ser posterior a la fecha de inicio/i,
    );

    // Creación exitosa de año lectivo
    fireEvent.change(screen.getByLabelText(/Fecha de fin/i), {
      target: { value: '2028-06-30' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-anio'));
    await waitFor(() => {
      expect(screen.getByTestId('alerta-exito-configuracion')).toHaveTextContent(
        /Año lectivo "2027-2028" registrado/i,
      );
    });

    // Trimestre: fechas obligatorias y dentro del año lectivo (RF-07)
    fireEvent.click(screen.getByTestId('boton-crear-trimestre'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /Ingrese las fechas de inicio y fin del trimestre/i,
    );
    fireEvent.change(screen.getByLabelText(/^Trimestre$/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/Inicio del trimestre/i), {
      target: { value: '2027-12-01' },
    });
    fireEvent.change(screen.getByLabelText(/Fin del trimestre/i), {
      target: { value: '2028-02-28' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-trimestre'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /dentro del año lectivo/i,
    );
    expect(servicioMock.crearPeriodo).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Inicio del trimestre/i), {
      target: { value: '2026-12-01' },
    });
    fireEvent.change(screen.getByLabelText(/Fin del trimestre/i), {
      target: { value: '2027-02-28' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-trimestre'));
    await waitFor(() => {
      expect(screen.getByTestId('lista-trimestres')).toHaveTextContent(
        'Trimestre 2',
      );
    });
    expect(servicioMock.crearPeriodo).toHaveBeenCalledWith({
      anioLectivoId: '55555555-5555-5555-5555-555555555555',
      numero: 2,
      inicio: '2026-12-01',
      fin: '2027-02-28',
    });

    // Pestaña Cursos y paralelos
    fireEvent.click(screen.getByTestId('tab-cursos'));
    expect(screen.getByTestId('lista-cursos')).toHaveTextContent('9no EGB');

    fireEvent.click(screen.getByTestId('boton-crear-curso'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /Ingrese el nivel/i,
    );

    fireEvent.change(screen.getByLabelText(/Nivel \/ Curso/i), {
      target: { value: '10mo EGB' },
    });
    fireEvent.change(screen.getByLabelText(/Paralelo/i), {
      target: { value: 'B' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-curso'));
    await waitFor(() => {
      expect(screen.getByTestId('lista-cursos')).toHaveTextContent('10mo EGB');
    });

    // Pestaña Materias
    fireEvent.click(screen.getByTestId('tab-materias'));
    expect(screen.getByTestId('lista-materias')).toHaveTextContent(
      'Matemática',
    );

    fireEvent.click(screen.getByTestId('boton-crear-materia'));
    expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
      /Ingrese el código y el nombre/i,
    );

    fireEvent.change(screen.getByLabelText(/^Código$/i), {
      target: { value: 'len' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre de la materia/i), {
      target: { value: 'Lengua y Literatura' },
    });
    fireEvent.change(screen.getByLabelText(/Área curricular/i), {
      target: { value: 'Comunicación' },
    });
    fireEvent.click(screen.getByTestId('boton-crear-materia'));
    await waitFor(() => {
      expect(screen.getByTestId('lista-materias')).toHaveTextContent(
        'Lengua y Literatura',
      );
    });
    expect(servicioMock.crearMateria).toHaveBeenCalledWith({
      codigo: 'LEN',
      nombre: 'Lengua y Literatura',
      area: 'Comunicación',
    });
  });

  it('muestra el error devuelto por ms-academico cuando falla la carga inicial', async () => {
    const servicioError = {
      listarAniosLectivos: vi
        .fn()
        .mockRejectedValue(
          new ErrorHttpApi(403, 'PROHIBIDO', 'Solo el administrador'),
        ),
      crearAnioLectivo: vi.fn(),
      listarPeriodos: vi.fn(),
      crearPeriodo: vi.fn(),
      listarCursos: vi.fn(),
      crearCurso: vi.fn(),
      listarMaterias: vi.fn().mockResolvedValue([]),
      crearMateria: vi.fn(),
    };

    render(<PantallaConfiguracionAcademica servicio={servicioError} />);

    await waitFor(() => {
      expect(screen.getByTestId('alerta-error-configuracion')).toHaveTextContent(
        /Solo el administrador/i,
      );
    });
  });
});
