import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type Curso,
  type Materia,
  type Periodo,
} from '../api/academicoConfigApi';
import type { CodigoRol } from '../api/clienteHttp';
import {
  servicioTareasApi,
  type EntregaTarea,
  type EstadoEntregaTarea,
  type TareaAcademica,
  type TipoActividadAcademica,
} from '../api/tareasApi';

export interface PropiedadesPantallaTareas {
  rolActivo: CodigoRol;
  nombreUsuario: string;
  tareasIniciales?: ReadonlyArray<TareaAcademica>;
  entregasIniciales?: ReadonlyArray<EntregaTarea>;
  cursosIniciales?: ReadonlyArray<Curso>;
  materiasIniciales?: ReadonlyArray<Materia>;
  periodosIniciales?: ReadonlyArray<Periodo>;
  omitirCargaRemota?: boolean;
}

const CURSOS_DEMO: ReadonlyArray<Curso> = [
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

const MATERIAS_DEMO: ReadonlyArray<Materia> = [
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

const PERIODOS_DEMO: ReadonlyArray<Periodo> = [
  {
    id: 'demo-per-1',
    anioLectivoId: 'demo-anio-1',
    numero: 1,
    inicio: '2025-09-01',
    fin: '2025-11-30',
    cerrado: false,
    version: 1,
  },
];

const TAREAS_DEMO_INICIALES: ReadonlyArray<TareaAcademica> = [
  {
    id: 'tar-demo-1',
    titulo: 'Taller de ecuaciones lineales',
    descripcion: 'Resolver los 10 ejercicios propuestos en la guía del bloque 1.',
    tipo: 'TAREA',
    cursoId: 'demo-curso-1',
    materiaId: 'demo-mat-1',
    periodoId: 'demo-per-1',
    fechaEntrega: '2026-11-28',
    puntajeMaximo: 10,
    creadoPor: 'docente.demo',
    version: 1,
  },
  {
    id: 'tar-demo-2',
    titulo: 'Prueba escrita del Bloque 1',
    descripcion: 'Evaluación presencial sobre operaciones con fracciones y decimales.',
    tipo: 'PRUEBA',
    cursoId: 'demo-curso-1',
    materiaId: 'demo-mat-1',
    periodoId: 'demo-per-1',
    fechaEntrega: '2026-11-30',
    puntajeMaximo: 10,
    creadoPor: 'docente.demo',
    version: 1,
  },
  {
    id: 'tar-demo-3',
    titulo: 'Proyecto integrador: Estadística escolar',
    descripcion: 'Encuesta y gráficos de barras con conclusiones sobre hábitos de lectura.',
    tipo: 'PROYECTO',
    cursoId: 'demo-curso-1',
    materiaId: 'demo-mat-1',
    periodoId: 'demo-per-1',
    fechaEntrega: '2026-12-05',
    puntajeMaximo: 10,
    creadoPor: 'docente.demo',
    version: 1,
  },
];

const ENTREGAS_DEMO_INICIALES: ReadonlyArray<EntregaTarea> = [
  {
    id: 'ent-demo-1',
    tareaId: 'tar-demo-1',
    estudianteId: 'est-sim-1',
    nombreEstudiante: 'Simulada Ana',
    comentario: 'Adjunto resolución completa de los 10 ejercicios.',
    enlaceAdjunto: 'https://aulaconecta.local/adjuntos/taller-1.pdf',
    estado: 'ENTREGADA',
    calificacion: null,
    fechaEntregaReal: '2026-11-19',
    version: 1,
  },
  {
    id: 'ent-demo-2',
    tareaId: 'tar-demo-3',
    estudianteId: 'ana.perez',
    nombreEstudiante: 'ana.perez',
    comentario: 'Presentación de encuesta aplicada a 20 compañeros.',
    estado: 'CALIFICADA',
    calificacion: 9.25,
    observacionDocente: 'Excelente análisis gráfico y conclusiones claras.',
    fechaEntregaReal: '2026-11-18',
    version: 2,
  },
];

const ETIQUETAS_TIPO: Record<TipoActividadAcademica, string> = {
  TAREA: 'Tarea',
  PRUEBA: 'Prueba',
  PROYECTO: 'Proyecto',
};

function claseBadgeTipo(tipo: TipoActividadAcademica): string {
  switch (tipo) {
    case 'TAREA':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'PRUEBA':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'PROYECTO':
      return 'bg-purple-100 text-purple-800 border-purple-200';
  }
}

function claseBadgeEstado(estado: EstadoEntregaTarea): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'ENTREGADA':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'CALIFICADA':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
}

export function PantallaTareas({
  rolActivo,
  nombreUsuario,
  tareasIniciales = TAREAS_DEMO_INICIALES,
  entregasIniciales = ENTREGAS_DEMO_INICIALES,
  cursosIniciales = CURSOS_DEMO,
  materiasIniciales = MATERIAS_DEMO,
  periodosIniciales = PERIODOS_DEMO,
  omitirCargaRemota = false,
}: Readonly<PropiedadesPantallaTareas>) {
  const esDocente = rolActivo === 'DOCENTE';

  const [cursos, setCursos] = useState<Curso[]>(() => [...cursosIniciales]);
  const [materias, setMaterias] = useState<Materia[]>(() => [...materiasIniciales]);
  const [periodos, setPeriodos] = useState<Periodo[]>(() => [...periodosIniciales]);

  const [cursoId, setCursoId] = useState<string>(() => cursosIniciales[0]?.id ?? '');
  const [materiaId, setMateriaId] = useState<string>(() => materiasIniciales[0]?.id ?? '');
  const [periodoId, setPeriodoId] = useState<string>(() => periodosIniciales[0]?.id ?? '');

  const [tareas, setTareas] = useState<TareaAcademica[]>(() => [...tareasIniciales]);
  const [entregas, setEntregas] = useState<EntregaTarea[]>(() => [...entregasIniciales]);

  const [filtroTipo, setFiltroTipo] = useState<'TODAS' | TipoActividadAcademica>('TODAS');
  const [filtroEstadoEstudiante, setFiltroEstadoEstudiante] = useState<
    'TODAS' | EstadoEntregaTarea
  >('TODAS');

  // Formulario docente
  const [tituloNuevo, setTituloNuevo] = useState<string>('');
  const [tipoNuevo, setTipoNuevo] = useState<TipoActividadAcademica>('TAREA');
  const [fechaEntregaNueva, setFechaEntregaNueva] = useState<string>('2026-12-01');
  const [puntajeNuevo, setPuntajeNuevo] = useState<string>('10');
  const [descripcionNueva, setDescripcionNueva] = useState<string>('');

  // Modal de entregas (docente)
  const [tareaRevisionId, setTareaRevisionId] = useState<string | null>(null);
  const [notasEdicion, setNotasEdicion] = useState<Record<string, string>>({});
  const [observacionesEdicion, setObservacionesEdicion] = useState<
    Record<string, string>
  >({});

  // Modal de entrega (estudiante)
  const [tareaEntregaId, setTareaEntregaId] = useState<string | null>(null);
  const [comentarioEntrega, setComentarioEntrega] = useState<string>('');
  const [enlaceEntrega, setEnlaceEntrega] = useState<string>('');

  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const cargarCatalogosYTareas = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    setCargando(true);
    try {
      const [cursosApi, materiasApi, aniosApi, tareasApi] = await Promise.all([
        servicioAcademicoConfigApi.listarCursos().catch(() => []),
        servicioAcademicoConfigApi.listarMaterias().catch(() => []),
        servicioAcademicoConfigApi.listarAniosLectivos().catch(() => []),
        servicioTareasApi.listarTareas().catch(() => []),
      ]);

      if (cursosApi.length > 0) {
        setCursos(cursosApi);
        setCursoId((prev) => prev || cursosApi[0].id);
      }
      if (materiasApi.length > 0) {
        setMaterias(materiasApi);
        setMateriaId((prev) => prev || materiasApi[0].id);
      }
      if (aniosApi.length > 0) {
        const activo = aniosApi.find((a) => a.activo) ?? aniosApi[0];
        const periodosApi = await servicioAcademicoConfigApi
          .listarPeriodos(activo.id)
          .catch(() => []);
        if (periodosApi.length > 0) {
          setPeriodos(periodosApi);
          setPeriodoId((prev) => prev || periodosApi[0].id);
        }
      }
      if (tareasApi.length > 0) {
        setTareas(tareasApi);
      }
    } finally {
      setCargando(false);
    }
  }, [omitirCargaRemota]);

  useEffect(() => {
    cargarCatalogosYTareas().catch(() => undefined);
  }, [cargarCatalogosYTareas]);

  const mapaCursos = useMemo(
    () => new Map(cursos.map((c) => [c.id, `${c.nivel} "${c.paralelo}"`])),
    [cursos],
  );
  const mapaMaterias = useMemo(
    () => new Map(materias.map((m) => [m.id, `${m.codigo} · ${m.nombre}`])),
    [materias],
  );

  const entregaPorTareaEstudiante = useMemo(() => {
    const mapa = new Map<string, EntregaTarea>();
    for (const entrega of entregas) {
      if (
        entrega.estudianteId === nombreUsuario ||
        entrega.nombreEstudiante === nombreUsuario
      ) {
        mapa.set(entrega.tareaId, entrega);
      }
    }
    return mapa;
  }, [entregas, nombreUsuario]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((tarea) => {
      if (filtroTipo !== 'TODAS' && tarea.tipo !== filtroTipo) {
        return false;
      }
      if (!esDocente && filtroEstadoEstudiante !== 'TODAS') {
        const entrega = entregaPorTareaEstudiante.get(tarea.id);
        const estadoActual: EstadoEntregaTarea = entrega?.estado ?? 'PENDIENTE';
        if (estadoActual !== filtroEstadoEstudiante) {
          return false;
        }
      }
      return true;
    });
  }, [
    entregaPorTareaEstudiante,
    esDocente,
    filtroEstadoEstudiante,
    filtroTipo,
    tareas,
  ]);

  const resumenEstudiante = useMemo(() => {
    let pendientes = 0;
    let entregadas = 0;
    let calificadas = 0;
    for (const tarea of tareas) {
      const estado = entregaPorTareaEstudiante.get(tarea.id)?.estado ?? 'PENDIENTE';
      if (estado === 'PENDIENTE') pendientes += 1;
      else if (estado === 'ENTREGADA') entregadas += 1;
      else calificadas += 1;
    }
    return { pendientes, entregadas, calificadas };
  }, [entregaPorTareaEstudiante, tareas]);

  const manejarPublicarTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const titulo = tituloNuevo.trim();
    const descripcion = descripcionNueva.trim();
    const puntaje = Number(puntajeNuevo.replace(',', '.'));

    if (!titulo) {
      setMensajeError('Ingresa un título para la tarea, prueba o proyecto.');
      return;
    }
    if (!fechaEntregaNueva) {
      setMensajeError('Selecciona la fecha límite de entrega.');
      return;
    }
    if (!Number.isFinite(puntaje) || puntaje <= 0 || puntaje > 10) {
      setMensajeError('El puntaje máximo debe estar entre 1 y 10.');
      return;
    }

    setGuardando(true);
    const solicitud = {
      titulo,
      descripcion: descripcion || 'Actividad académica registrada en AulaConecta.',
      tipo: tipoNuevo,
      cursoId,
      materiaId,
      periodoId,
      fechaEntrega: fechaEntregaNueva,
      puntajeMaximo: puntaje,
    };

    try {
      let creada: TareaAcademica;
      if (omitirCargaRemota) {
        creada = {
          id: `tar-${Date.now()}`,
          ...solicitud,
          creadoPor: nombreUsuario,
          version: 1,
        };
      } else {
        try {
          creada = await servicioTareasApi.crearTarea(solicitud);
        } catch {
          creada = {
            id: `tar-local-${Date.now()}`,
            ...solicitud,
            creadoPor: nombreUsuario,
            version: 1,
          };
        }
      }
      setTareas((prev) => [creada, ...prev]);
      setTituloNuevo('');
      setDescripcionNueva('');
      setMensajeExito(
        `${ETIQUETAS_TIPO[creada.tipo]} "${creada.titulo}" publicada correctamente.`,
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalEntregas = async (tareaId: string) => {
    setTareaRevisionId(tareaId);
    setMensajeError(null);

    let listaActual = entregas.filter((ent) => ent.tareaId === tareaId);
    if (!omitirCargaRemota) {
      try {
        const remotas = await servicioTareasApi.listarEntregas(tareaId);
        if (remotas.length > 0) {
          listaActual = remotas;
          setEntregas((prev) => [
            ...prev.filter((ent) => ent.tareaId !== tareaId),
            ...remotas,
          ]);
        }
      } catch {
        // Conserva entregas locales en modo demostrativo
      }
    }

    const notasInit: Record<string, string> = {};
    const obsInit: Record<string, string> = {};
    for (const ent of listaActual) {
      notasInit[ent.id] =
        ent.calificacion === null ? '' : String(ent.calificacion);
      obsInit[ent.id] = ent.observacionDocente ?? '';
    }
    setNotasEdicion(notasInit);
    setObservacionesEdicion(obsInit);
  };

  const manejarCalificarEntrega = async (
    entrega: EntregaTarea,
    puntajeMaximo: number,
  ) => {
    setMensajeError(null);
    setMensajeExito(null);

    const textoNota = (notasEdicion[entrega.id] ?? '').trim().replace(',', '.');
    const nota = Number(textoNota);
    if (!textoNota || !Number.isFinite(nota) || nota < 0 || nota > puntajeMaximo) {
      setMensajeError(
        `La calificación para ${entrega.nombreEstudiante} debe estar entre 0 y ${puntajeMaximo}.`,
      );
      return;
    }

    const observacion = (observacionesEdicion[entrega.id] ?? '').trim();
    setGuardando(true);
    try {
      let actualizada: EntregaTarea;
      if (omitirCargaRemota) {
        actualizada = {
          ...entrega,
          estado: 'CALIFICADA',
          calificacion: nota,
          observacionDocente: observacion || undefined,
          version: entrega.version + 1,
        };
      } else {
        try {
          actualizada = await servicioTareasApi.calificarEntrega(entrega.id, {
            calificacion: nota,
            observacionDocente: observacion,
          });
        } catch {
          actualizada = {
            ...entrega,
            estado: 'CALIFICADA',
            calificacion: nota,
            observacionDocente: observacion || undefined,
            version: entrega.version + 1,
          };
        }
      }

      setEntregas((prev) =>
        prev.map((item) => (item.id === entrega.id ? actualizada : item)),
      );
      setMensajeExito(
        `Entrega de ${entrega.nombreEstudiante} calificada con ${nota.toFixed(2)}.`,
      );
    } finally {
      setGuardando(false);
    }
  };

  const manejarEnviarEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tareaEntregaId) {
      return;
    }
    setMensajeError(null);
    setMensajeExito(null);

    const comentario = comentarioEntrega.trim();
    if (!comentario) {
      setMensajeError('Escribe una respuesta o descripción de tu entrega.');
      return;
    }

    setGuardando(true);
    const solicitud = {
      tareaId: tareaEntregaId,
      estudianteId: nombreUsuario,
      nombreEstudiante: nombreUsuario,
      comentario,
      enlaceAdjunto: enlaceEntrega.trim() || undefined,
    };

    try {
      let registrada: EntregaTarea;
      if (omitirCargaRemota) {
        registrada = {
          id: `ent-${Date.now()}`,
          tareaId: tareaEntregaId,
          estudianteId: nombreUsuario,
          nombreEstudiante: nombreUsuario,
          comentario,
          enlaceAdjunto: solicitud.enlaceAdjunto,
          estado: 'ENTREGADA',
          calificacion: null,
          fechaEntregaReal: new Date().toISOString().slice(0, 10),
          version: 1,
        };
      } else {
        try {
          registrada = await servicioTareasApi.enviarEntrega(solicitud);
        } catch {
          registrada = {
            id: `ent-local-${Date.now()}`,
            tareaId: tareaEntregaId,
            estudianteId: nombreUsuario,
            nombreEstudiante: nombreUsuario,
            comentario,
            enlaceAdjunto: solicitud.enlaceAdjunto,
            estado: 'ENTREGADA',
            calificacion: null,
            fechaEntregaReal: new Date().toISOString().slice(0, 10),
            version: 1,
          };
        }
      }

      setEntregas((prev) => [
        ...prev.filter(
          (item) =>
            !(
              item.tareaId === tareaEntregaId &&
              (item.estudianteId === nombreUsuario ||
                item.nombreEstudiante === nombreUsuario)
            ),
        ),
        registrada,
      ]);
      setTareaEntregaId(null);
      setComentarioEntrega('');
      setEnlaceEntrega('');
      setMensajeExito('Entrega enviada correctamente al docente.');
    } finally {
      setGuardando(false);
    }
  };

  const tareaEnRevision = useMemo(
    () => tareas.find((t) => t.id === tareaRevisionId) ?? null,
    [tareaRevisionId, tareas],
  );
  const entregasDeTareaEnRevision = useMemo(
    () => entregas.filter((ent) => ent.tareaId === tareaRevisionId),
    [entregas, tareaRevisionId],
  );
  const tareaParaEntregar = useMemo(
    () => tareas.find((t) => t.id === tareaEntregaId) ?? null,
    [tareaEntregaId, tareas],
  );

  return (
    <section
      data-testid="pantalla-tareas"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Tareas, pruebas y proyectos · RF-19 ·{' '}
            {esDocente ? 'Vista Docente' : 'Vista Estudiante'}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" aria-hidden="true" />
            {esDocente
              ? 'Gestión de Tareas, Pruebas y Proyectos'
              : 'Mis Tareas, Pruebas y Proyectos'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {esDocente
              ? 'Publica actividades académicas por curso y asignatura, revisa las entregas estudiantiles y asigna calificaciones.'
              : 'Consulta tus actividades asignadas, envía tus entregas y revisa tus calificaciones y observaciones.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cargarCatalogosYTareas().catch(() => undefined);
          }}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50 self-start lg:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Actualizar listado
        </button>
      </header>

      {mensajeExito && (
        <div
          data-testid="aviso-exito-tareas"
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2 font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          data-testid="aviso-error-tareas"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </div>
      )}

      {esDocente ? (
        <div data-testid="vista-tareas-docente" className="space-y-6">
          {/* Formulario de creación de tarea/prueba/proyecto */}
          <form
            onSubmit={manejarPublicarTarea}
            className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              Publicar nueva actividad (RF-19)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label
                  htmlFor="input-titulo-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Título de la actividad
                </label>
                <input
                  id="input-titulo-tarea"
                  data-testid="input-titulo-tarea"
                  type="text"
                  placeholder="Ej. Maqueta del sistema solar"
                  value={tituloNuevo}
                  onChange={(e) => setTituloNuevo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="select-tipo-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tipo
                </label>
                <select
                  id="select-tipo-tarea"
                  data-testid="select-tipo-tarea"
                  value={tipoNuevo}
                  onChange={(e) =>
                    setTipoNuevo(e.target.value as TipoActividadAcademica)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="TAREA">Tarea</option>
                  <option value="PRUEBA">Prueba</option>
                  <option value="PROYECTO">Proyecto</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="input-fecha-entrega-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Fecha límite
                </label>
                <input
                  id="input-fecha-entrega-tarea"
                  data-testid="input-fecha-entrega-tarea"
                  type="date"
                  value={fechaEntregaNueva}
                  onChange={(e) => setFechaEntregaNueva(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="select-curso-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Curso y paralelo
                </label>
                <select
                  id="select-curso-tarea"
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
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
                  htmlFor="select-materia-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Asignatura
                </label>
                <select
                  id="select-materia-tarea"
                  value={materiaId}
                  onChange={(e) => setMateriaId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
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
                  htmlFor="select-periodo-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Trimestre
                </label>
                <select
                  id="select-periodo-tarea"
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {periodos.map((per) => (
                    <option key={per.id} value={per.id}>
                      Trimestre {per.numero}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="input-puntaje-tarea"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Puntaje máximo
                </label>
                <input
                  id="input-puntaje-tarea"
                  data-testid="input-puntaje-tarea"
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={puntajeNuevo}
                  onChange={(e) => setPuntajeNuevo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="input-descripcion-tarea"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Instrucciones para el estudiante
              </label>
              <textarea
                id="input-descripcion-tarea"
                data-testid="input-descripcion-tarea"
                rows={2}
                placeholder="Describe criterios de evaluación, formato o recursos..."
                value={descripcionNueva}
                onChange={(e) => setDescripcionNueva(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="boton-publicar-tarea"
                disabled={guardando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {guardando ? 'Publicando…' : 'Publicar actividad'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div data-testid="vista-tareas-estudiante" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Pendientes</p>
              <p className="text-xl font-bold text-slate-900">
                {resumenEstudiante.pendientes}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5">
              <p className="text-xs text-indigo-700">Entregadas</p>
              <p className="text-xl font-bold text-indigo-900">
                {resumenEstudiante.entregadas}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
              <p className="text-xs text-emerald-800">Calificadas</p>
              <p className="text-xl font-bold text-emerald-900">
                {resumenEstudiante.calificadas}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Barra de filtros compartida */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="filtro-tipo-actividad" className="text-xs font-semibold text-slate-700">
            Tipo:
          </label>
          <select
            id="filtro-tipo-actividad"
            data-testid="filtro-tipo-tareas"
            value={filtroTipo}
            onChange={(e) =>
              setFiltroTipo(e.target.value as 'TODAS' | TipoActividadAcademica)
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="TODAS">Todas las actividades</option>
            <option value="TAREA">Tareas</option>
            <option value="PRUEBA">Pruebas</option>
            <option value="PROYECTO">Proyectos</option>
          </select>

          {!esDocente && (
            <>
              <label
                htmlFor="filtro-estado-actividad"
                className="text-xs font-semibold text-slate-700 ml-2"
              >
                Estado:
              </label>
              <select
                id="filtro-estado-actividad"
                data-testid="filtro-estado-tareas-estudiante"
                value={filtroEstadoEstudiante}
                onChange={(e) =>
                  setFiltroEstadoEstudiante(
                    e.target.value as 'TODAS' | EstadoEntregaTarea,
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                <option value="TODAS">Todos los estados</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="ENTREGADA">Entregadas</option>
                <option value="CALIFICADA">Calificadas</option>
              </select>
            </>
          )}
        </div>

        <span className="text-xs text-slate-500">
          {tareasFiltradas.length}{' '}
          {tareasFiltradas.length === 1 ? 'actividad' : 'actividades'}
        </span>
      </div>

      {/* Listado de tareas, pruebas y proyectos */}
      {tareasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          No existen actividades registradas para el filtro seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tareasFiltradas.map((tarea) => {
            const entregasTarea = entregas.filter((ent) => ent.tareaId === tarea.id);
            const entregaEst = entregaPorTareaEstudiante.get(tarea.id);
            const estadoEst: EstadoEntregaTarea = entregaEst?.estado ?? 'PENDIENTE';

            return (
              <article
                key={tarea.id}
                data-testid={`tarjeta-tarea-${tarea.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${claseBadgeTipo(tarea.tipo)}`}
                    >
                      {ETIQUETAS_TIPO[tarea.tipo]}
                    </span>

                    {esDocente ? (
                      <span className="text-xs font-semibold text-slate-600">
                        {entregasTarea.length}{' '}
                        {entregasTarea.length === 1 ? 'entrega' : 'entregas'}
                      </span>
                    ) : (
                      <span
                        data-testid={`estado-entrega-${tarea.id}`}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${claseBadgeEstado(estadoEst)}`}
                      >
                        {estadoEst === 'PENDIENTE'
                          ? 'Pendiente'
                          : estadoEst === 'ENTREGADA'
                            ? 'Entregada'
                            : `Calificada · ${entregaEst?.calificacion?.toFixed(2) ?? '—'} / ${tarea.puntajeMaximo}`}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900">
                    {tarea.titulo}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tarea.descripcion}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      {mapaMaterias.get(tarea.materiaId) ?? 'Asignatura'} ·{' '}
                      {mapaCursos.get(tarea.cursoId) ?? 'Curso'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      Entrega: {tarea.fechaEntrega}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Sobre {tarea.puntajeMaximo} pts
                    </span>
                  </div>

                  {!esDocente && entregaEst?.observacionDocente && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                      <strong>Observación docente:</strong>{' '}
                      {entregaEst.observacionDocente}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {esDocente ? (
                    <button
                      type="button"
                      data-testid={`boton-ver-entregas-${tarea.id}`}
                      onClick={() => {
                        abrirModalEntregas(tarea.id).catch(() => undefined);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Revisar entregas ({entregasTarea.length})
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid={`boton-abrir-entrega-${tarea.id}`}
                      onClick={() => {
                        setTareaEntregaId(tarea.id);
                        setComentarioEntrega(entregaEst?.comentario ?? '');
                        setEnlaceEntrega(entregaEst?.enlaceAdjunto ?? '');
                        setMensajeError(null);
                      }}
                      disabled={estadoEst === 'CALIFICADA'}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {estadoEst === 'CALIFICADA' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Ya calificada
                        </>
                      ) : estadoEst === 'ENTREGADA' ? (
                        <>
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          Actualizar entrega
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          Entregar actividad
                        </>
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de revisión de entregas para Docente */}
      {esDocente && tareaEnRevision && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-entregas"
          data-testid="modal-entregas-docente"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Revisión de entregas · {ETIQUETAS_TIPO[tareaEnRevision.tipo]}
                </span>
                <h3
                  id="titulo-modal-entregas"
                  className="text-lg font-bold text-slate-900 mt-1"
                >
                  {tareaEnRevision.titulo}
                </h3>
                <p className="text-xs text-slate-500">
                  Puntaje máximo: {tareaEnRevision.puntajeMaximo} pts · Fecha límite:{' '}
                  {tareaEnRevision.fechaEntrega}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar revisión de entregas"
                onClick={() => setTareaRevisionId(null)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {entregasDeTareaEnRevision.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aún no existen entregas registradas para esta actividad.
              </p>
            ) : (
              <div className="space-y-4">
                {entregasDeTareaEnRevision.map((entrega) => (
                  <div
                    key={entrega.id}
                    className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-slate-900">
                        {entrega.nombreEstudiante}
                      </strong>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${claseBadgeEstado(entrega.estado)}`}
                      >
                        {entrega.estado}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">{entrega.comentario}</p>
                    {entrega.enlaceAdjunto && (
                      <p className="text-xs font-mono text-indigo-700 break-all">
                        Adjunto: {entrega.enlaceAdjunto}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                      <div>
                        <label
                          htmlFor={`nota-${entrega.id}`}
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Nota (0 – {tareaEnRevision.puntajeMaximo})
                        </label>
                        <input
                          id={`nota-${entrega.id}`}
                          data-testid={`input-nota-entrega-${entrega.id}`}
                          type="text"
                          inputMode="decimal"
                          value={notasEdicion[entrega.id] ?? ''}
                          onChange={(e) =>
                            setNotasEdicion((prev) => ({
                              ...prev,
                              [entrega.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`obs-${entrega.id}`}
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Observación pedagógica
                        </label>
                        <input
                          id={`obs-${entrega.id}`}
                          data-testid={`input-observacion-entrega-${entrega.id}`}
                          type="text"
                          placeholder="Retroalimentación para el estudiante…"
                          value={observacionesEdicion[entrega.id] ?? ''}
                          onChange={(e) =>
                            setObservacionesEdicion((prev) => ({
                              ...prev,
                              [entrega.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        data-testid={`boton-calificar-entrega-${entrega.id}`}
                        disabled={guardando}
                        onClick={() => {
                          manejarCalificarEntrega(
                            entrega,
                            tareaEnRevision.puntajeMaximo,
                          ).catch(() => undefined);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Guardar calificación
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de entrega para Estudiante */}
      {!esDocente && tareaParaEntregar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-entrega-est"
          data-testid="modal-entrega-estudiante"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={manejarEnviarEntrega}
            className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Entrega de actividad · {ETIQUETAS_TIPO[tareaParaEntregar.tipo]}
                </span>
                <h3
                  id="titulo-modal-entrega-est"
                  className="text-lg font-bold text-slate-900 mt-1"
                >
                  {tareaParaEntregar.titulo}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar ventana de entrega"
                onClick={() => setTareaEntregaId(null)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label
                htmlFor="input-comentario-entrega"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Respuesta o comentario de la entrega
              </label>
              <textarea
                id="input-comentario-entrega"
                data-testid="input-comentario-entrega"
                rows={3}
                placeholder="Describe tu resolución o el trabajo realizado…"
                value={comentarioEntrega}
                onChange={(e) => setComentarioEntrega(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="input-enlace-entrega"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Enlace o referencia de archivo adjunto (opcional)
              </label>
              <input
                id="input-enlace-entrega"
                data-testid="input-enlace-entrega"
                type="text"
                placeholder="https://… o nombre del documento"
                value={enlaceEntrega}
                onChange={(e) => setEnlaceEntrega(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTareaEntregaId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="boton-confirmar-entrega"
                disabled={guardando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                {guardando ? 'Enviando…' : 'Enviar entrega'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
