import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type AnioLectivo,
  type Curso,
  type Materia,
} from '../api/academicoConfigApi';
import {
  servicioAsistenciaApi,
  type EstadoAsistencia,
  type EstadoJustificacion,
  type RegistroAsistencia,
} from '../api/asistenciaApi';
import { ErrorHttpApi } from '../api/clienteHttp';

export interface FilaAsistencia {
  id?: string;
  asignacionId: string;
  matriculaId: string;
  estudianteId: string;
  nombreEstudiante: string;
  estado: EstadoAsistencia;
  estadoPersistido: EstadoAsistencia | null;
  justificacion: string;
  estadoJustificacion: EstadoJustificacion;
  confirmarCambio: boolean;
  version: number;
  modificada: boolean;
}

export interface PropiedadesPantallaAsistencia {
  filasIniciales?: ReadonlyArray<FilaAsistencia>;
  cursosIniciales?: ReadonlyArray<Curso>;
  materiasIniciales?: ReadonlyArray<Materia>;
  aniosIniciales?: ReadonlyArray<AnioLectivo>;
  fechaInicial?: string;
  omitirCargaRemota?: boolean;
}

const CATALOGO_DEMO_ANIOS: ReadonlyArray<AnioLectivo> = [
  {
    id: 'demo-anio-1',
    nombre: '2025-2026',
    inicio: '2025-09-01',
    fin: '2026-06-30',
    activo: true,
    version: 1,
  },
];

const CATALOGO_DEMO_CURSOS: ReadonlyArray<Curso> = [
  {
    id: 'demo-curso-1',
    anioLectivoId: 'demo-anio-1',
    nivel: '8vo EGB',
    paralelo: 'A',
    version: 1,
  },
  {
    id: 'demo-curso-2',
    anioLectivoId: 'demo-anio-1',
    nivel: '9no EGB',
    paralelo: 'B',
    version: 1,
  },
];

const CATALOGO_DEMO_MATERIAS: ReadonlyArray<Materia> = [
  {
    id: 'demo-mat-1',
    codigo: 'MAT',
    nombre: 'Matemática',
    area: 'Ciencias Exactas',
    version: 1,
  },
  {
    id: 'demo-mat-2',
    codigo: 'LEN',
    nombre: 'Lengua y Literatura',
    area: 'Humanidades',
    version: 1,
  },
];

const FILAS_DEMO_ASISTENCIA: ReadonlyArray<FilaAsistencia> = [
  {
    id: 'asist-demo-1',
    asignacionId: 'demo-asig-1',
    matriculaId: 'matr-1',
    estudianteId: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    estado: 'PRESENTE',
    estadoPersistido: 'PRESENTE',
    justificacion: '',
    estadoJustificacion: null,
    confirmarCambio: false,
    version: 1,
    modificada: false,
  },
  {
    id: 'asist-demo-2',
    asignacionId: 'demo-asig-1',
    matriculaId: 'matr-2',
    estudianteId: 'est-2',
    nombreEstudiante: 'Simulado Bruno',
    estado: 'FALTA',
    estadoPersistido: 'FALTA',
    justificacion: 'Reposo médico por gripe (adjunta certificado).',
    estadoJustificacion: 'SOLICITADA',
    confirmarCambio: false,
    version: 1,
    modificada: false,
  },
  {
    id: 'asist-demo-3',
    asignacionId: 'demo-asig-1',
    matriculaId: 'matr-3',
    estudianteId: 'est-3',
    nombreEstudiante: 'Inventada Camila',
    estado: 'JUSTIFICADA',
    estadoPersistido: 'JUSTIFICADA',
    justificacion: 'Calamidad doméstica comunicada al tutor.',
    estadoJustificacion: 'APROBADA',
    confirmarCambio: false,
    version: 2,
    modificada: false,
  },
  {
    id: 'asist-demo-4',
    asignacionId: 'demo-asig-1',
    matriculaId: 'matr-4',
    estudianteId: 'est-4',
    nombreEstudiante: 'Simulado Diego',
    estado: 'ATRASO',
    estadoPersistido: 'ATRASO',
    justificacion: '',
    estadoJustificacion: null,
    confirmarCambio: false,
    version: 1,
    modificada: false,
  },
  {
    id: 'asist-demo-5',
    asignacionId: 'demo-asig-1',
    matriculaId: 'matr-5',
    estudianteId: 'est-5',
    nombreEstudiante: 'Inventada Elena',
    estado: 'PRESENTE',
    estadoPersistido: null,
    justificacion: '',
    estadoJustificacion: null,
    confirmarCambio: false,
    version: 0,
    modificada: false,
  },
];

interface DefinicionBotonEstado {
  estado: EstadoAsistencia;
  sigla: string;
  etiqueta: string;
  claseActiva: string;
}

const BOTONES_ESTADO: ReadonlyArray<DefinicionBotonEstado> = [
  {
    estado: 'PRESENTE',
    sigla: 'P',
    etiqueta: 'Presente',
    claseActiva: 'bg-emerald-600 text-white border-emerald-700 shadow-sm',
  },
  {
    estado: 'FALTA',
    sigla: 'F',
    etiqueta: 'Falta',
    claseActiva: 'bg-rose-600 text-white border-rose-700 shadow-sm',
  },
  {
    estado: 'ATRASO',
    sigla: 'A',
    etiqueta: 'Atraso',
    claseActiva: 'bg-amber-500 text-white border-amber-600 shadow-sm',
  },
  {
    estado: 'JUSTIFICADA',
    sigla: 'J',
    etiqueta: 'Justif.',
    claseActiva: 'bg-sky-600 text-white border-sky-700 shadow-sm',
  },
];

function clonarFilas(filas: ReadonlyArray<FilaAsistencia>): FilaAsistencia[] {
  return filas.map((fila) => ({ ...fila }));
}

function mapearRegistroAFila(reg: RegistroAsistencia): FilaAsistencia {
  return {
    id: reg.id,
    asignacionId: reg.asignacionId,
    matriculaId: reg.matriculaId,
    estudianteId: reg.estudianteId ?? reg.matriculaId,
    nombreEstudiante: reg.nombreEstudiante?.trim() || `Estudiante ${reg.matriculaId}`,
    estado: reg.estado,
    estadoPersistido: reg.estado,
    justificacion: reg.justificacion ?? '',
    estadoJustificacion: reg.estadoJustificacion,
    confirmarCambio: false,
    version: reg.version,
    modificada: false,
  };
}

function etiquetaEstado(estado: EstadoAsistencia): string {
  switch (estado) {
    case 'PRESENTE':
      return 'Presente';
    case 'FALTA':
      return 'Falta';
    case 'ATRASO':
      return 'Atraso';
    case 'JUSTIFICADA':
      return 'Justificada';
  }
}

function claseBadgeEstado(estado: EstadoAsistencia): string {
  switch (estado) {
    case 'PRESENTE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'FALTA':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'ATRASO':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'JUSTIFICADA':
      return 'bg-sky-100 text-sky-800 border-sky-200';
  }
}

export function PantallaAsistencia({
  filasIniciales = FILAS_DEMO_ASISTENCIA,
  cursosIniciales = CATALOGO_DEMO_CURSOS,
  materiasIniciales = CATALOGO_DEMO_MATERIAS,
  aniosIniciales = CATALOGO_DEMO_ANIOS,
  fechaInicial = '2026-05-15',
  omitirCargaRemota = false,
}: Readonly<PropiedadesPantallaAsistencia>) {
  const [anios, setAnios] = useState<AnioLectivo[]>(() => [...aniosIniciales]);
  const [cursos, setCursos] = useState<Curso[]>(() => [...cursosIniciales]);
  const [materias, setMaterias] = useState<Materia[]>(() => [...materiasIniciales]);

  const [cursoId, setCursoId] = useState<string>(
    () => cursosIniciales[0]?.id ?? '',
  );
  const [materiaId, setMateriaId] = useState<string>(
    () => materiasIniciales[0]?.id ?? '',
  );
  const [fecha, setFecha] = useState<string>(fechaInicial);

  const [filas, setFilas] = useState<FilaAsistencia[]>(() =>
    clonarFilas(filasIniciales),
  );
  const [busqueda, setBusqueda] = useState<string>('');
  const [soloSolicitudes, setSoloSolicitudes] = useState<boolean>(false);

  const [matriculaPendienteConfirmar, setMatriculaPendienteConfirmar] =
    useState<string | null>(null);

  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const cursoActual = useMemo(
    () => cursos.find((c) => c.id === cursoId) ?? null,
    [cursos, cursoId],
  );

  const anioActivo = useMemo(() => {
    if (cursoActual) {
      const anioCurso = anios.find((a) => a.id === cursoActual.anioLectivoId);
      if (anioCurso) {
        return anioCurso;
      }
    }
    return anios.find((a) => a.activo) ?? anios[0] ?? null;
  }, [anios, cursoActual]);

  const asignacionActivaId = useMemo(() => {
    if (cursoId && materiaId) {
      return `${cursoId}-${materiaId}`;
    }
    return filas[0]?.asignacionId ?? 'demo-asig-1';
  }, [cursoId, filas, materiaId]);

  const cargarCatalogosYAsistencia = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    setCargando(true);
    try {
      const [aniosApi, cursosApi, materiasApi, asistenciasApi] =
        await Promise.all([
          servicioAcademicoConfigApi.listarAniosLectivos().catch(() => []),
          servicioAcademicoConfigApi.listarCursos().catch(() => []),
          servicioAcademicoConfigApi.listarMaterias().catch(() => []),
          servicioAsistenciaApi
            .listarAsistencias({
              asignacionId: asignacionActivaId,
              fecha,
            })
            .catch(() => []),
        ]);

      if (aniosApi.length > 0) {
        setAnios(aniosApi);
      }
      if (cursosApi.length > 0) {
        setCursos(cursosApi);
        setCursoId((prev) => prev || cursosApi[0].id);
      }
      if (materiasApi.length > 0) {
        setMaterias(materiasApi);
        setMateriaId((prev) => prev || materiasApi[0].id);
      }
      if (asistenciasApi.length > 0) {
        setFilas(asistenciasApi.map(mapearRegistroAFila));
      }
    } finally {
      setCargando(false);
    }
  }, [asignacionActivaId, fecha, omitirCargaRemota]);

  useEffect(() => {
    cargarCatalogosYAsistencia().catch(() => undefined);
  }, [cargarCatalogosYAsistencia]);

  const contadores = useMemo(() => {
    let presentes = 0;
    let faltas = 0;
    let atrasos = 0;
    let justificadas = 0;
    let solicitudesPendientes = 0;
    let modificadas = 0;

    for (const fila of filas) {
      if (fila.estado === 'PRESENTE') presentes += 1;
      else if (fila.estado === 'FALTA') faltas += 1;
      else if (fila.estado === 'ATRASO') atrasos += 1;
      else justificadas += 1;

      if (fila.estadoJustificacion === 'SOLICITADA') {
        solicitudesPendientes += 1;
      }
      if (fila.modificada) {
        modificadas += 1;
      }
    }

    return {
      presentes,
      faltas,
      atrasos,
      justificadas,
      solicitudesPendientes,
      modificadas,
    };
  }, [filas]);

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return filas.filter((fila) => {
      if (soloSolicitudes && fila.estadoJustificacion !== 'SOLICITADA') {
        return false;
      }
      if (termino && !fila.nombreEstudiante.toLowerCase().includes(termino)) {
        return false;
      }
      return true;
    });
  }, [busqueda, filas, soloSolicitudes]);

  const filaConfirmandoFalta = useMemo(
    () =>
      filas.find((f) => f.matriculaId === matriculaPendienteConfirmar) ?? null,
    [filas, matriculaPendienteConfirmar],
  );

  const actualizarEstadoFila = (
    matriculaId: string,
    nuevoEstado: EstadoAsistencia,
  ) => {
    setMensajeError(null);
    setMensajeExito(null);

    const filaObjetivo = filas.find((f) => f.matriculaId === matriculaId);
    if (!filaObjetivo) {
      return;
    }

    if (
      nuevoEstado === 'FALTA' &&
      filaObjetivo.estadoPersistido === 'JUSTIFICADA'
    ) {
      setMatriculaPendienteConfirmar(matriculaId);
      return;
    }

    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === matriculaId
          ? {
              ...fila,
              estado: nuevoEstado,
              confirmarCambio: false,
              estadoJustificacion:
                nuevoEstado === 'JUSTIFICADA'
                  ? 'APROBADA'
                  : fila.estadoJustificacion,
              modificada: true,
            }
          : fila,
      ),
    );
  };

  const confirmarCambioAFalta = () => {
    if (!matriculaPendienteConfirmar) {
      return;
    }
    const objetivo = matriculaPendienteConfirmar;
    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === objetivo
          ? {
              ...fila,
              estado: 'FALTA',
              confirmarCambio: true,
              estadoJustificacion: null,
              modificada: true,
            }
          : fila,
      ),
    );
    setMatriculaPendienteConfirmar(null);
  };

  const manejarMarcarTodosPresentes = () => {
    setMensajeError(null);
    setMensajeExito(null);
    const idsVisibles = new Set(filasFiltradas.map((f) => f.matriculaId));
    if (idsVisibles.size === 0) {
      return;
    }

    setFilas((prev) =>
      prev.map((fila) => {
        if (!idsVisibles.has(fila.matriculaId) || fila.estado === 'PRESENTE') {
          return fila;
        }
        return {
          ...fila,
          estado: 'PRESENTE',
          confirmarCambio: false,
          modificada: true,
        };
      }),
    );
  };

  const manejarAprobarJustificacion = (matriculaId: string) => {
    setMensajeError(null);
    setMensajeExito(null);
    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === matriculaId
          ? {
              ...fila,
              estado: 'JUSTIFICADA',
              estadoJustificacion: 'APROBADA',
              confirmarCambio: false,
              modificada: true,
            }
          : fila,
      ),
    );
  };

  const manejarCambioJustificacion = (matriculaId: string, texto: string) => {
    setMensajeError(null);
    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === matriculaId
          ? {
              ...fila,
              justificacion: texto,
              modificada: true,
            }
          : fila,
      ),
    );
  };

  const manejarGuardarAsistencia = async () => {
    setMensajeError(null);
    setMensajeExito(null);

    if (!fecha) {
      setMensajeError('Selecciona la fecha de la clase.');
      return;
    }

    if (anioActivo && (fecha < anioActivo.inicio || fecha > anioActivo.fin)) {
      setMensajeError(
        `La fecha ${fecha} está fuera del año lectivo (${anioActivo.inicio} a ${anioActivo.fin}).`,
      );
      return;
    }

    const filasModificadas = filas.filter((f) => f.modificada);
    if (filasModificadas.length === 0) {
      setMensajeExito('No hay cambios pendientes por guardar.');
      return;
    }

    const filaSinMotivo = filasModificadas.find(
      (f) => f.estado === 'JUSTIFICADA' && !f.justificacion.trim(),
    );
    if (filaSinMotivo) {
      setMensajeError(
        `Ingresa el motivo de justificación para ${filaSinMotivo.nombreEstudiante}.`,
      );
      return;
    }

    setGuardando(true);
    try {
      const actualizadas = new Map<string, FilaAsistencia>();

      for (const fila of filasModificadas) {
        const motivoLimpio = fila.justificacion.trim();
        let persistida: FilaAsistencia;

        if (omitirCargaRemota) {
          persistida = {
            ...fila,
            justificacion: fila.estado === 'JUSTIFICADA' ? motivoLimpio : '',
            estadoPersistido: fila.estado,
            estadoJustificacion:
              fila.estado === 'JUSTIFICADA'
                ? 'APROBADA'
                : fila.estadoJustificacion,
            confirmarCambio: false,
            version: fila.version + 1,
            modificada: false,
          };
        } else {
          try {
            const respuesta = await servicioAsistenciaApi.guardarAsistencia({
              id: fila.id,
              asignacionId: fila.asignacionId || asignacionActivaId,
              matriculaId: fila.matriculaId,
              fecha,
              estado: fila.estado,
              justificacion:
                fila.estado === 'JUSTIFICADA' ? motivoLimpio : null,
              confirmar: fila.confirmarCambio ? true : undefined,
              version: fila.version,
            });
            persistida = mapearRegistroAFila(respuesta);
          } catch (error) {
            if (
              error instanceof ErrorHttpApi &&
              error.estado >= 400 &&
              error.estado < 500
            ) {
              setMensajeError(error.message);
              return;
            }
            persistida = {
              ...fila,
              justificacion: fila.estado === 'JUSTIFICADA' ? motivoLimpio : '',
              estadoPersistido: fila.estado,
              estadoJustificacion:
                fila.estado === 'JUSTIFICADA'
                  ? 'APROBADA'
                  : fila.estadoJustificacion,
              confirmarCambio: false,
              version: fila.version + 1,
              modificada: false,
            };
          }
        }

        actualizadas.set(fila.matriculaId, persistida);
      }

      setFilas((prev) =>
        prev.map((fila) => actualizadas.get(fila.matriculaId) ?? fila),
      );
      setMensajeExito(
        `Asistencia guardada correctamente (${actualizadas.size} ${actualizadas.size === 1 ? 'registro actualizado' : 'registros actualizados'}).`,
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      data-testid="pantalla-asistencia"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5"
    >
      {/* Cabecera */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Asistencia por materia · RF-21 · Vista móvil rápida
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600" aria-hidden="true" />
            Toma de Asistencia Rápida
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registra presencia, faltas, atrasos y aprueba justificaciones en un toque desde el celular.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cargarCatalogosYAsistencia().catch(() => undefined);
          }}
          disabled={cargando}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Actualizar lista
        </button>
      </header>

      {/* Selectores de curso, asignatura y fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-3.5">
        <div>
          <label
            htmlFor="select-curso-asistencia"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Curso y paralelo
          </label>
          <select
            id="select-curso-asistencia"
            data-testid="select-curso-asistencia"
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 min-h-[44px] text-xs font-semibold text-slate-800"
          >
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nivel} &ldquo;{curso.paralelo}&rdquo;
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="select-materia-asistencia"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Asignatura
          </label>
          <select
            id="select-materia-asistencia"
            data-testid="select-materia-asistencia"
            value={materiaId}
            onChange={(e) => setMateriaId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 min-h-[44px] text-xs font-semibold text-slate-800"
          >
            {materias.map((mat) => (
              <option key={mat.id} value={mat.id}>
                {mat.codigo} · {mat.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="input-fecha-asistencia"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Fecha de clase
          </label>
          <div className="relative">
            <Calendar
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="input-fecha-asistencia"
              data-testid="input-fecha-asistencia"
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setMensajeError(null);
                setMensajeExito(null);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 min-h-[44px] text-xs font-semibold text-slate-800"
            />
          </div>
          {anioActivo && (
            <p className="text-[11px] text-slate-500 mt-1">
              Año lectivo {anioActivo.nombre}: {anioActivo.inicio} al{' '}
              {anioActivo.fin}
            </p>
          )}
        </div>
      </div>

      {/* Avisos de éxito o error */}
      {mensajeExito && (
        <div
          data-testid="aviso-exito-asistencia"
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2 font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          data-testid="aviso-error-asistencia"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </div>
      )}

      {/* Contadores rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          data-testid="contador-presentes"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-[11px] font-medium text-emerald-800">Presentes</p>
            <p className="text-xl font-bold text-emerald-950">
              {contadores.presentes}
            </p>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        </div>

        <div
          data-testid="contador-faltas"
          className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-[11px] font-medium text-rose-800">Faltas</p>
            <p className="text-xl font-bold text-rose-950">
              {contadores.faltas}
            </p>
          </div>
          <UserX className="w-5 h-5 text-rose-600" aria-hidden="true" />
        </div>

        <div
          data-testid="contador-atrasos"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-[11px] font-medium text-amber-800">Atrasos</p>
            <p className="text-xl font-bold text-amber-950">
              {contadores.atrasos}
            </p>
          </div>
          <Clock className="w-5 h-5 text-amber-600" aria-hidden="true" />
        </div>

        <div
          data-testid="contador-justificadas"
          className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-[11px] font-medium text-sky-800">
              Justificadas
            </p>
            <p className="text-xl font-bold text-sky-950">
              {contadores.justificadas}
            </p>
          </div>
          <FileCheck2 className="w-5 h-5 text-sky-600" aria-hidden="true" />
        </div>
      </div>

      {/* Acciones rápidas y búsqueda móvil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="boton-todos-presentes"
            onClick={manejarMarcarTodosPresentes}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 min-h-[44px] text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            Marcar todos presentes
          </button>

          <button
            type="button"
            data-testid="filtro-solicitudes-justificacion"
            aria-pressed={soloSolicitudes}
            onClick={() => setSoloSolicitudes((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer ${
              soloSolicitudes
                ? 'bg-sky-600 text-white border-sky-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Solicitudes pendientes ({contadores.solicitudesPendientes})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            data-testid="input-buscar-estudiante-asistencia"
            aria-label="Buscar estudiante"
            placeholder="Buscar estudiante…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 min-h-[44px] text-xs text-slate-900"
          />
        </div>
      </div>

      {/* Tarjetas táctiles de estudiantes (mobile-first) */}
      {filasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          No existen estudiantes que coincidan con el filtro aplicado.
        </div>
      ) : (
        <div className="space-y-3">
          {filasFiltradas.map((fila) => (
            <article
              key={fila.matriculaId}
              data-testid={`tarjeta-asistencia-${fila.matriculaId}`}
              className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                fila.modificada
                  ? 'border-indigo-300 bg-indigo-50/30'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {fila.nombreEstudiante}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Matrícula: {fila.matriculaId}
                    {fila.modificada ? ' · Pendiente de guardar' : ''}
                  </p>
                </div>

                <span
                  data-testid={`estado-actual-${fila.matriculaId}`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${claseBadgeEstado(fila.estado)}`}
                >
                  {etiquetaEstado(fila.estado)}
                </span>
              </div>

              {/* Barra segmentada táctil de 4 estados */}
              <div
                role="group"
                aria-label={`Estado de asistencia de ${fila.nombreEstudiante}`}
                className="grid grid-cols-4 gap-2"
              >
                {BOTONES_ESTADO.map((btn) => {
                  const activo = fila.estado === btn.estado;
                  return (
                    <button
                      key={btn.estado}
                      type="button"
                      data-testid={`btn-estado-${fila.matriculaId}-${btn.estado}`}
                      aria-pressed={activo}
                      aria-label={`${btn.etiqueta} para ${fila.nombreEstudiante}`}
                      onClick={() =>
                        actualizarEstadoFila(fila.matriculaId, btn.estado)
                      }
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl border px-2 py-2 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer ${
                        activo
                          ? btn.claseActiva
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-bold sm:hidden">{btn.sigla}</span>
                      <span className="text-[11px] sm:text-xs">
                        {btn.etiqueta}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Solicitud de justificación enviada por el estudiante */}
              {fila.estadoJustificacion === 'SOLICITADA' && (
                <div
                  data-testid={`solicitud-justificacion-${fila.matriculaId}`}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      Solicitud de justificación pendiente (CU-19)
                    </p>
                    <p className="text-xs text-amber-950">
                      {fila.justificacion || 'Sin motivo especificado.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid={`boton-aprobar-justificacion-${fila.matriculaId}`}
                    onClick={() =>
                      manejarAprobarJustificacion(fila.matriculaId)
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 min-h-[44px] text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <FileCheck2 className="w-4 h-4" aria-hidden="true" />
                    Aprobar justificación
                  </button>
                </div>
              )}

              {/* Campo de motivo cuando el estado es JUSTIFICADA */}
              {fila.estado === 'JUSTIFICADA' && (
                <div>
                  <label
                    htmlFor={`justificacion-${fila.matriculaId}`}
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Motivo de justificación (obligatorio)
                  </label>
                  <input
                    id={`justificacion-${fila.matriculaId}`}
                    data-testid={`input-justificacion-${fila.matriculaId}`}
                    type="text"
                    maxLength={255}
                    placeholder="Ej. Certificado médico presentado por el representante"
                    value={fila.justificacion}
                    onChange={(e) =>
                      manejarCambioJustificacion(
                        fila.matriculaId,
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 min-h-[44px] text-xs text-slate-900"
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Barra fija inferior para guardar fácilmente con el pulgar en celular */}
      <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <p className="text-xs font-semibold text-slate-600">
          {contadores.modificadas === 0
            ? 'Todos los registros están al día.'
            : `${contadores.modificadas} ${contadores.modificadas === 1 ? 'cambio pendiente' : 'cambios pendientes'} por guardar`}
        </p>

        <button
          type="button"
          data-testid="boton-guardar-asistencia"
          disabled={guardando}
          onClick={() => {
            manejarGuardarAsistencia().catch(() => undefined);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 min-h-[48px] text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {guardando ? 'Guardando…' : 'Guardar asistencia'}
        </button>
      </div>

      {/* Modal de confirmación al volver a FALTA una falta ya JUSTIFICADA (excepción RF-21) */}
      {filaConfirmandoFalta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-confirmar-falta"
          data-testid="modal-confirmar-falta"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3
                  id="titulo-modal-confirmar-falta"
                  className="text-base font-bold text-slate-900"
                >
                  Confirmar cambio a Falta
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar confirmación"
                onClick={() => setMatriculaPendienteConfirmar(null)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              La asistencia de{' '}
              <strong>{filaConfirmandoFalta.nombreEstudiante}</strong> ya estaba
              registrada como <strong>Justificada</strong>
              {filaConfirmandoFalta.justificacion
                ? ` ("${filaConfirmandoFalta.justificacion}")`
                : ''}
              . ¿Deseas revertirla a <strong>Falta</strong>?
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="boton-cancelar-cambio-falta"
                onClick={() => setMatriculaPendienteConfirmar(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="boton-confirmar-cambio-falta"
                onClick={confirmarCambioAFalta}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 min-h-[44px] text-xs font-semibold cursor-pointer"
              >
                Sí, marcar como Falta
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
