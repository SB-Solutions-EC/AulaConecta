import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  servicioAcademicoConfigApi,
  type Curso,
  type Materia,
  type Periodo,
} from '../api/academicoConfigApi';
import {
  servicioTareasApi,
  type EntregaTarea,
  type TareaAcademica,
} from '../api/tareasApi';
import { PantallaTareas } from './PantallaTareas';
import {
  normalizarNotaSobreDiez,
  obtenerEquivalenciaCualitativa,
} from './VistaTareasEstudiante';

const CURSOS: ReadonlyArray<Curso> = [
  {
    id: 'cur-1',
    anioLectivoId: 'anio-1',
    nivel: '8vo EGB',
    paralelo: 'A',
    version: 1,
  },
];

const MATERIAS: ReadonlyArray<Materia> = [
  {
    id: 'mat-1',
    codigo: 'MAT',
    nombre: 'Matemática',
    area: 'Ciencias Exactas',
    version: 1,
  },
  {
    id: 'mat-2',
    codigo: 'LEN',
    nombre: 'Lengua y Literatura',
    area: 'Humanidades',
    version: 1,
  },
];

const PERIODOS: ReadonlyArray<Periodo> = [
  {
    id: 'per-1',
    anioLectivoId: 'anio-1',
    numero: 1,
    inicio: '2026-09-01',
    fin: '2026-11-30',
    cerrado: false,
    version: 1,
  },
];

const TAREAS_PRUEBA: ReadonlyArray<TareaAcademica> = [
  {
    id: 'tar-est-1',
    titulo: 'Taller de fracciones',
    descripcion: 'Resolver la guía de operaciones.',
    tipo: 'TAREA',
    cursoId: 'cur-1',
    materiaId: 'mat-1',
    periodoId: 'per-1',
    fechaEntrega: '2026-11-22',
    puntajeMaximo: 10,
    creadoPor: 'docente.mat',
    version: 1,
  },
  {
    id: 'tar-est-2',
    titulo: 'Ensayo literario',
    descripcion: 'Análisis de lectura del capítulo 3.',
    tipo: 'PROYECTO',
    cursoId: 'cur-1',
    materiaId: 'mat-2',
    periodoId: 'per-1',
    fechaEntrega: '2026-11-25',
    puntajeMaximo: 10,
    creadoPor: 'docente.len',
    version: 1,
  },
  {
    id: 'tar-est-3',
    titulo: 'Lección escrita de geometría',
    descripcion: 'Cálculo de áreas y perímetros.',
    tipo: 'PRUEBA',
    cursoId: 'cur-1',
    materiaId: 'mat-1',
    periodoId: 'per-1',
    fechaEntrega: '2026-11-28',
    puntajeMaximo: 10,
    creadoPor: 'docente.mat',
    version: 1,
  },
];

describe('VistaTareasEstudiante (RF-20: Nota y retroalimentación de tareas)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calcula correctamente la normalización y la equivalencia cualitativa DA, AA, PA y NA', () => {
    expect(normalizarNotaSobreDiez(9.5, 10)).toBe(9.5);
    expect(normalizarNotaSobreDiez(18, 20)).toBe(9);
    expect(normalizarNotaSobreDiez(5, 0)).toBe(0);

    expect(obtenerEquivalenciaCualitativa(9.0).codigo).toBe('DA');
    expect(obtenerEquivalenciaCualitativa(7.0).codigo).toBe('AA');
    expect(obtenerEquivalenciaCualitativa(5.5).codigo).toBe('PA');
    expect(obtenerEquivalenciaCualitativa(4.0).codigo).toBe('NA');
    expect(obtenerEquivalenciaCualitativa(2.0).codigo).toBe('NA');
  });

  it('muestra el promedio de tareas calificadas, equivalencias y permite filtrar por estado, tipo y asignatura', () => {
    const entregas: EntregaTarea[] = [
      {
        id: 'ent-1',
        tareaId: 'tar-est-1',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: 'Ejercicios resueltos en PDF.',
        enlaceAdjunto: 'https://aulaconecta.local/fracciones.pdf',
        estado: 'CALIFICADA',
        calificacion: 9.5,
        observacionDocente: 'Excelente desarrollo paso a paso.',
        fechaEntregaReal: '2026-11-20',
        version: 2,
      },
      {
        id: 'ent-2',
        tareaId: 'tar-est-2',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: 'Ensayo completo.',
        estado: 'CALIFICADA',
        calificacion: 7.5,
        observacionDocente: 'Buen análisis, cuida las citas.',
        fechaEntregaReal: '2026-11-21',
        version: 2,
      },
    ];

    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        tareasIniciales={TAREAS_PRUEBA}
        entregasIniciales={entregas}
        cursosIniciales={CURSOS}
        materiasIniciales={MATERIAS}
        periodosIniciales={PERIODOS}
        omitirCargaRemota
      />,
    );

    const resumenPromedio = screen.getByTestId('resumen-promedio-estudiante');
    expect(resumenPromedio).toHaveTextContent('8.50 / 10');
    expect(resumenPromedio).toHaveTextContent('AA');

    expect(screen.getByTestId('equivalencia-tarea-tar-est-1')).toHaveTextContent(
      'DA · Domina los aprendizajes',
    );
    expect(screen.getByTestId('equivalencia-tarea-tar-est-2')).toHaveTextContent(
      'AA · Alcanza los aprendizajes',
    );

    // Filtrar por estado CALIFICADA
    fireEvent.change(screen.getByTestId('filtro-estado-tareas-estudiante'), {
      target: { value: 'CALIFICADA' },
    });
    expect(screen.getByTestId('tarjeta-tarea-tar-est-1')).toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-tarea-tar-est-2')).toBeInTheDocument();
    expect(
      screen.queryByTestId('tarjeta-tarea-tar-est-3'),
    ).not.toBeInTheDocument();

    // Filtrar por asignatura Lengua (mat-2)
    fireEvent.change(screen.getByTestId('filtro-materia-tareas-estudiante'), {
      target: { value: 'mat-2' },
    });
    expect(
      screen.queryByTestId('tarjeta-tarea-tar-est-1'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-tarea-tar-est-2')).toBeInTheDocument();

    // Filtrar por tipo TAREA quita el proyecto de Lengua
    fireEvent.change(screen.getByTestId('filtro-tipo-tareas'), {
      target: { value: 'TAREA' },
    });
    expect(
      screen.queryByTestId('tarjeta-tarea-tar-est-2'),
    ).not.toBeInTheDocument();
  });

  it('abre y cierra el modal de detalle de nota y retroalimentación, y muestra alerta de refuerzo si es menor a 7.00', () => {
    const entregas: EntregaTarea[] = [
      {
        id: 'ent-1',
        tareaId: 'tar-est-1',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: 'Adjunto resolución del taller.',
        enlaceAdjunto: 'https://aulaconecta.local/ana-taller.pdf',
        estado: 'CALIFICADA',
        calificacion: 6.25,
        observacionDocente: 'Faltó justificar los últimos dos ejercicios.',
        fechaEntregaReal: '2026-11-20',
        version: 2,
      },
      {
        id: 'ent-2',
        tareaId: 'tar-est-2',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: 'Ensayo sin observación escrita.',
        estado: 'CALIFICADA',
        calificacion: 9.0,
        fechaEntregaReal: '2026-11-21',
        version: 2,
      },
    ];

    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        tareasIniciales={TAREAS_PRUEBA}
        entregasIniciales={entregas}
        cursosIniciales={CURSOS}
        materiasIniciales={MATERIAS}
        periodosIniciales={PERIODOS}
        omitirCargaRemota
      />,
    );

    expect(screen.getByTestId('aviso-refuerzo-tar-est-1')).toHaveTextContent(
      'Requiere refuerzo',
    );
    expect(
      screen.queryByTestId('aviso-refuerzo-tar-est-2'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-tarea-tar-est-2')).toHaveTextContent(
      'Sin retroalimentación escrita del docente.',
    );

    // Abrir detalle de tarea con nota menor a 7
    fireEvent.click(screen.getByTestId('boton-ver-retroalimentacion-tar-est-1'));
    const modal = screen.getByTestId('modal-retroalimentacion-estudiante');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('6.25 / 10');
    expect(modal).toHaveTextContent('PA · Próximo a alcanzar');
    expect(modal).toHaveTextContent('Requiere refuerzo académico');
    expect(
      screen.getByTestId('detalle-retroalimentacion-docente'),
    ).toHaveTextContent('Faltó justificar los últimos dos ejercicios.');
    expect(modal).toHaveTextContent('Adjunto resolución del taller.');
    expect(modal).toHaveTextContent('https://aulaconecta.local/ana-taller.pdf');

    fireEvent.click(
      screen.getByRole('button', { name: /Cerrar detalle de calificación/i }),
    );
    expect(
      screen.queryByTestId('modal-retroalimentacion-estudiante'),
    ).not.toBeInTheDocument();
  });

  it('aísla las notas y retroalimentación: un estudiante nunca ve entregas calificadas de otro estudiante (RF-20, RNF-04)', () => {
    const entregas: EntregaTarea[] = [
      {
        id: 'ent-ajena',
        tareaId: 'tar-est-1',
        estudianteId: 'otro.estudiante',
        nombreEstudiante: 'otro.estudiante',
        comentario: 'Entrega privada de otro estudiante.',
        estado: 'CALIFICADA',
        calificacion: 10,
        observacionDocente: 'Retroalimentación confidencial ajena.',
        fechaEntregaReal: '2026-11-20',
        version: 2,
      },
    ];

    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        tareasIniciales={TAREAS_PRUEBA}
        entregasIniciales={entregas}
        cursosIniciales={CURSOS}
        materiasIniciales={MATERIAS}
        periodosIniciales={PERIODOS}
        omitirCargaRemota
      />,
    );

    expect(screen.getByTestId('estado-entrega-tar-est-1')).toHaveTextContent(
      'Pendiente',
    );
    expect(
      screen.queryByText(/Retroalimentación confidencial ajena/i),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('resumen-promedio-estudiante')).toHaveTextContent(
      'Sin calificaciones aún',
    );
  });

  it('carga las entregas calificadas del estudiante desde la API cuando omitirCargaRemota es false', async () => {
    vi.spyOn(servicioAcademicoConfigApi, 'listarCursos').mockResolvedValue([
      ...CURSOS,
    ]);
    vi.spyOn(servicioAcademicoConfigApi, 'listarMaterias').mockResolvedValue([
      ...MATERIAS,
    ]);
    vi.spyOn(
      servicioAcademicoConfigApi,
      'listarAniosLectivos',
    ).mockResolvedValue([]);
    vi.spyOn(servicioTareasApi, 'listarTareas').mockResolvedValue([
      TAREAS_PRUEBA[0],
    ]);
    vi.spyOn(servicioTareasApi, 'listarEntregas').mockResolvedValue([
      {
        id: 'ent-api-1',
        tareaId: 'tar-est-1',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: 'Mi entrega remota',
        estado: 'CALIFICADA',
        calificacion: 8.75,
        observacionDocente: 'Buen trabajo desde la API.',
        fechaEntregaReal: '2026-11-20',
        version: 2,
      },
    ]);

    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        tareasIniciales={[]}
        entregasIniciales={[]}
        cursosIniciales={CURSOS}
        materiasIniciales={MATERIAS}
        periodosIniciales={PERIODOS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('estado-entrega-tar-est-1')).toHaveTextContent(
        'Calificada · 8.75 / 10',
      );
      expect(
        screen.getByText('Buen trabajo desde la API.'),
      ).toBeInTheDocument();
    });
  });

  it('muestra como texto literal cargas XSS en retroalimentación, comentario y enlace dentro del modal', () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const entregasHostiles: EntregaTarea[] = [
      {
        id: 'ent-xss-modal',
        tareaId: 'tar-est-1',
        estudianteId: 'ana.perez',
        nombreEstudiante: 'ana.perez',
        comentario: '<script>alert("comentario")</script>',
        enlaceAdjunto: 'javascript:alert(document.cookie)',
        estado: 'CALIFICADA',
        calificacion: 8,
        observacionDocente: '<img src=x onerror=alert("retro")> Revisar',
        fechaEntregaReal: '2026-11-20',
        version: 2,
      },
    ];

    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        tareasIniciales={[TAREAS_PRUEBA[0]]}
        entregasIniciales={entregasHostiles}
        cursosIniciales={CURSOS}
        materiasIniciales={MATERIAS}
        periodosIniciales={PERIODOS}
        omitirCargaRemota
      />,
    );

    fireEvent.click(screen.getByTestId('boton-ver-retroalimentacion-tar-est-1'));
    const modal = screen.getByTestId('modal-retroalimentacion-estudiante');

    expect(modal.textContent).toContain('<img src=x onerror=alert("retro")> Revisar');
    expect(modal.textContent).toContain('<script>alert("comentario")</script>');
    expect(modal.textContent).toContain('javascript:alert(document.cookie)');
    expect(document.body.querySelectorAll('script, img, iframe')).toHaveLength(
      0,
    );
    for (const elemento of document.body.querySelectorAll('*')) {
      const eventos = elemento
        .getAttributeNames()
        .filter((nombre) => /^on/i.test(nombre));
      expect(eventos).toEqual([]);
    }
    for (const vinculo of document.body.querySelectorAll('[href], [src]')) {
      const destino = (
        vinculo.getAttribute('href') ??
        vinculo.getAttribute('src') ??
        ''
      ).trim();
      expect(destino).not.toMatch(/^(javascript|data|vbscript):/i);
    }
    expect(alerta).not.toHaveBeenCalled();
  });
});
