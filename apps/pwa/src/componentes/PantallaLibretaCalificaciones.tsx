import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  Eye,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type AnioLectivo,
  type Curso,
  type Materia,
  type Periodo,
} from '../api/academicoConfigApi';
import {
  servicioCalificacionesApi,
  type RegistroCalificacion,
  type SolicitudGuardarCalificacion,
} from '../api/calificacionesApi';
import {
  CAMPOS_BLOQUE_1,
  CAMPOS_BLOQUE_2,
  calcularCalificacionInmediata,
  calcularResumenEstandares,
  normalizarNotaEntrada,
  type EstandarLogro,
} from '../calculo/calculoNotas';

export interface FilaLibreta {
  id: string;
  registroId?: string;
  matriculaId: string;
  estudianteId: string;
  nombreEstudiante: string;
  bloque1: string[];
  bloque2: string[];
  refuerzo: string;
  proyecto: string;
  examen: string;
  version: number;
  modificada: boolean;
}

export interface PropiedadesPantallaLibretaCalificaciones {
  filasIniciales?: ReadonlyArray<FilaLibreta>;
  aniosIniciales?: ReadonlyArray<AnioLectivo>;
  periodosIniciales?: ReadonlyArray<Periodo>;
  cursosIniciales?: ReadonlyArray<Curso>;
  materiasIniciales?: ReadonlyArray<Materia>;
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

const CATALOGO_DEMO_PERIODOS: ReadonlyArray<Periodo> = [
  {
    id: 'demo-per-1',
    anioLectivoId: 'demo-anio-1',
    numero: 1,
    inicio: '2025-09-01',
    fin: '2025-11-30',
    cerrado: false,
    version: 1,
  },
  {
    id: 'demo-per-2',
    anioLectivoId: 'demo-anio-1',
    numero: 2,
    inicio: '2025-12-01',
    fin: '2026-03-15',
    cerrado: false,
    version: 1,
  },
  {
    id: 'demo-per-3',
    anioLectivoId: 'demo-anio-1',
    numero: 3,
    inicio: '2026-03-16',
    fin: '2026-06-30',
    cerrado: false,
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

const FILAS_DEMO_LIBRETA: ReadonlyArray<FilaLibreta> = [
  {
    id: 'est-1',
    matriculaId: 'matr-1',
    estudianteId: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    bloque1: ['9.0', '8.5', '9.0', '8.5', '9.0'],
    bloque2: ['9.0', '9.0', '8.5', '9.0', '9.5'],
    refuerzo: '',
    proyecto: '9.5',
    examen: '9.0',
    version: 1,
    modificada: false,
  },
  {
    id: 'est-2',
    matriculaId: 'matr-2',
    estudianteId: 'est-2',
    nombreEstudiante: 'Simulada Bruno',
    bloque1: ['6.0', '6.5', '5.5', '6.0', '6.0'],
    bloque2: ['6.0', '6.0', '6.5', '5.5', '6.0'],
    refuerzo: '8.0',
    proyecto: '7.5',
    examen: '7.0',
    version: 1,
    modificada: false,
  },
  {
    id: 'est-3',
    matriculaId: 'matr-3',
    estudianteId: 'est-3',
    nombreEstudiante: 'Inventado Camila',
    bloque1: ['5.5', '6.0', '5.0', '6.0', '5.5'],
    bloque2: ['6.0', '5.5', '6.0', '5.5', '6.0'],
    refuerzo: '',
    proyecto: '6.0',
    examen: '6.0',
    version: 1,
    modificada: false,
  },
];

type FiltroEstadoLibreta = 'TODOS' | 'REFUERZO' | 'INCOMPLETOS';

const ETIQUETAS_ESTANDAR: Record<EstandarLogro, string> = {
  DA: 'Domina (DA)',
  AA: 'Alcanza (AA)',
  PA: 'Próximo (PA)',
  NA: 'No alcanza (NA)',
};

function clonarFilas(filas: ReadonlyArray<FilaLibreta>): FilaLibreta[] {
  return filas.map((fila) => ({
    ...fila,
    bloque1: [...fila.bloque1],
    bloque2: [...fila.bloque2],
  }));
}

function normalizarArregloCinco(valores: ReadonlyArray<number | null>): string[] {
  return Array.from({ length: 5 }, (_, idx) => {
    const val = valores[idx];
    return typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
  });
}

function mapearRegistroAFila(reg: RegistroCalificacion): FilaLibreta {
  return {
    id: reg.estudianteId || reg.id,
    registroId: reg.id,
    matriculaId: reg.matriculaId,
    estudianteId: reg.estudianteId,
    nombreEstudiante: reg.nombreEstudiante,
    bloque1: normalizarArregloCinco(reg.bloque1),
    bloque2: normalizarArregloCinco(reg.bloque2),
    refuerzo: reg.refuerzo === null ? '' : String(reg.refuerzo),
    proyecto: reg.proyecto === null ? '' : String(reg.proyecto),
    examen: reg.examen === null ? '' : String(reg.examen),
    version: reg.version,
    modificada: false,
  };
}

function crearFilaVacia(indice: number, nombre?: string): FilaLibreta {
  return {
    id: `est-nuevo-${indice}`,
    matriculaId: `matr-nuevo-${indice}`,
    estudianteId: `est-nuevo-${indice}`,
    nombreEstudiante: nombre?.trim() || `Estudiante Demo ${indice}`,
    bloque1: ['', '', '', '', ''],
    bloque2: ['', '', '', '', ''],
    refuerzo: '',
    proyecto: '',
    examen: '',
    version: 1,
    modificada: true,
  };
}

export function esTextoNotaValido(valor: string): boolean {
  const limpio = valor.trim();
  if (!limpio) {
    return true;
  }
  return normalizarNotaEntrada(limpio) !== null;
}

function filaTieneErrores(fila: FilaLibreta): boolean {
  return (
    fila.bloque1.some((v) => !esTextoNotaValido(v)) ||
    fila.bloque2.some((v) => !esTextoNotaValido(v)) ||
    !esTextoNotaValido(fila.refuerzo) ||
    !esTextoNotaValido(fila.proyecto) ||
    !esTextoNotaValido(fila.examen)
  );
}

function formatearDecimal(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(2);
}

function claseBadgeCualitativo(cualitativo: string | null): string {
  if (!cualitativo) {
    return 'bg-slate-100 text-slate-500';
  }
  if (cualitativo === 'A+' || cualitativo === 'A-') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (cualitativo === 'B+' || cualitativo === 'B-') {
    return 'bg-sky-100 text-sky-800';
  }
  if (cualitativo === 'C+' || cualitativo === 'C-') {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-rose-100 text-rose-800';
}

export function PantallaLibretaCalificaciones({
  filasIniciales = FILAS_DEMO_LIBRETA,
  aniosIniciales = CATALOGO_DEMO_ANIOS,
  periodosIniciales = CATALOGO_DEMO_PERIODOS,
  cursosIniciales = CATALOGO_DEMO_CURSOS,
  materiasIniciales = CATALOGO_DEMO_MATERIAS,
  omitirCargaRemota = false,
}: Readonly<PropiedadesPantallaLibretaCalificaciones>) {
  const [anios, setAnios] = useState<AnioLectivo[]>(() => [...aniosIniciales]);
  const [anioId, setAnioId] = useState<string>(
    () => aniosIniciales.find((a) => a.activo)?.id ?? aniosIniciales[0]?.id ?? '',
  );
  const [periodos, setPeriodos] = useState<Periodo[]>(() => [...periodosIniciales]);
  const [periodoId, setPeriodoId] = useState<string>(
    () => periodosIniciales[0]?.id ?? '',
  );
  const [cursos, setCursos] = useState<Curso[]>(() => [...cursosIniciales]);
  const [cursoId, setCursoId] = useState<string>(
    () => cursosIniciales[0]?.id ?? '',
  );
  const [materias, setMaterias] = useState<Materia[]>(() => [...materiasIniciales]);
  const [materiaId, setMateriaId] = useState<string>(
    () => materiasIniciales[0]?.id ?? '',
  );

  const [filas, setFilas] = useState<FilaLibreta[]>(() =>
    clonarFilas(filasIniciales),
  );
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoLibreta>('TODOS');
  const [nombreNuevo, setNombreNuevo] = useState<string>('');
  const [filaDetalleId, setFilaDetalleId] = useState<string | null>(null);

  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState<boolean>(false);

  const periodoActual = useMemo(
    () => periodos.find((p) => p.id === periodoId) ?? null,
    [periodos, periodoId],
  );
  const cursoActual = useMemo(
    () => cursos.find((c) => c.id === cursoId) ?? null,
    [cursos, cursoId],
  );
  const materiaActual = useMemo(
    () => materias.find((m) => m.id === materiaId) ?? null,
    [materias, materiaId],
  );
  const trimestreCerrado = Boolean(periodoActual?.cerrado);

  const cargarCatalogos = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    try {
      const [aniosApi, cursosApi, materiasApi] = await Promise.all([
        servicioAcademicoConfigApi.listarAniosLectivos(),
        servicioAcademicoConfigApi.listarCursos(),
        servicioAcademicoConfigApi.listarMaterias(),
      ]);

      if (aniosApi.length > 0) {
        setAnios(aniosApi);
        const activo = aniosApi.find((a) => a.activo) ?? aniosApi[0];
        setAnioId(activo.id);
        const periodosApi = await servicioAcademicoConfigApi.listarPeriodos(activo.id);
        if (periodosApi.length > 0) {
          setPeriodos(periodosApi);
          setPeriodoId(periodosApi[0].id);
        }
      }

      if (cursosApi.length > 0) {
        setCursos(cursosApi);
        setCursoId(cursosApi[0].id);
      }

      if (materiasApi.length > 0) {
        setMaterias(materiasApi);
        setMateriaId(materiasApi[0].id);
      }
    } catch {
      setModoDemo(true);
    }
  }, [omitirCargaRemota]);

  const cargarLibreta = useCallback(async () => {
    if (omitirCargaRemota || !cursoId || !materiaId || !periodoId) {
      return;
    }
    setCargando(true);
    setMensajeError(null);
    try {
      const registros = await servicioCalificacionesApi.listarLibreta({
        cursoId,
        materiaId,
        periodoId,
      });
      if (registros.length > 0) {
        setFilas(registros.map(mapearRegistroAFila));
        setModoDemo(false);
      } else {
        setModoDemo(true);
      }
    } catch {
      setModoDemo(true);
    } finally {
      setCargando(false);
    }
  }, [cursoId, materiaId, omitirCargaRemota, periodoId]);

  useEffect(() => {
    cargarCatalogos().catch(() => undefined);
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarLibreta().catch(() => undefined);
  }, [cargarLibreta]);

  const manejarCambioAnio = async (nuevoAnioId: string) => {
    setAnioId(nuevoAnioId);
    if (omitirCargaRemota) {
      return;
    }
    try {
      const periodosApi = await servicioAcademicoConfigApi.listarPeriodos(nuevoAnioId);
      if (periodosApi.length > 0) {
        setPeriodos(periodosApi);
        setPeriodoId(periodosApi[0].id);
      }
    } catch {
      // Mantiene periodos actuales si la consulta falla
    }
  };

  const calculosPorId = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof calcularCalificacionInmediata>>();
    for (const fila of filas) {
      mapa.set(
        fila.id,
        calcularCalificacionInmediata({
          aportesBloque1: fila.bloque1.map(normalizarNotaEntrada),
          aportesBloque2: fila.bloque2.map(normalizarNotaEntrada),
          refuerzo: normalizarNotaEntrada(fila.refuerzo),
          notaProyecto: normalizarNotaEntrada(fila.proyecto),
          notaExamen: normalizarNotaEntrada(fila.examen),
        }),
      );
    }
    return mapa;
  }, [filas]);

  const resumenCurso = useMemo(
    () => calcularResumenEstandares(Array.from(calculosPorId.values())),
    [calculosPorId],
  );

  const filasVisibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return filas.filter((fila) => {
      if (termino && !fila.nombreEstudiante.toLowerCase().includes(termino)) {
        return false;
      }
      const calc = calculosPorId.get(fila.id);
      if (filtroEstado === 'REFUERZO') {
        return Boolean(calc?.alertaPromedioBajo);
      }
      if (filtroEstado === 'INCOMPLETOS') {
        return calc?.notaFinal === null;
      }
      return true;
    });
  }, [busqueda, calculosPorId, filas, filtroEstado]);

  const hayErroresValidacion = useMemo(
    () => filas.some(filaTieneErrores),
    [filas],
  );

  const cambiosPendientes = useMemo(
    () => filas.filter((f) => f.modificada).length,
    [filas],
  );

  const filaDetalle = useMemo(
    () => filas.find((f) => f.id === filaDetalleId) ?? null,
    [filaDetalleId, filas],
  );

  const actualizarAporte = (
    filaId: string,
    bloque: 'bloque1' | 'bloque2',
    indiceCampo: number,
    valor: string,
  ) => {
    if (trimestreCerrado) {
      return;
    }
    setMensajeExito(null);
    setMensajeError(null);
    setFilas((previas) =>
      previas.map((fila) => {
        if (fila.id !== filaId) {
          return fila;
        }
        const copiaBloque = [...fila[bloque]];
        copiaBloque[indiceCampo] = valor;
        return { ...fila, [bloque]: copiaBloque, modificada: true };
      }),
    );
  };

  const actualizarCampoSimple = (
    filaId: string,
    campo: 'refuerzo' | 'proyecto' | 'examen',
    valor: string,
  ) => {
    if (trimestreCerrado) {
      return;
    }
    setMensajeExito(null);
    setMensajeError(null);
    setFilas((previas) =>
      previas.map((fila) =>
        fila.id === filaId ? { ...fila, [campo]: valor, modificada: true } : fila,
      ),
    );
  };

  const agregarFilaEstudiante = () => {
    if (trimestreCerrado) {
      return;
    }
    const nueva = crearFilaVacia(filas.length + 1, nombreNuevo);
    setFilas((previas) => [...previas, nueva]);
    setNombreNuevo('');
    setMensajeExito(null);
  };

  const restablecerEjemplo = () => {
    setFilas(clonarFilas(filasIniciales));
    setMensajeExito(null);
    setMensajeError(null);
  };

  const guardarLibreta = async () => {
    if (trimestreCerrado) {
      setMensajeError('El trimestre está cerrado; no se pueden guardar cambios.');
      return;
    }
    if (hayErroresValidacion) {
      setMensajeError(
        'Corrige las notas fuera de rango (0.00 a 10.00) antes de guardar la libreta.',
      );
      return;
    }
    const filasAGuardar = filas.filter((f) => f.modificada);
    if (filasAGuardar.length === 0) {
      setMensajeExito('No hay cambios pendientes por guardar.');
      return;
    }

    setGuardando(true);
    setMensajeError(null);
    setMensajeExito(null);

    const solicitudes: SolicitudGuardarCalificacion[] = filasAGuardar.map((fila) => ({
      id: fila.registroId,
      matriculaId: fila.matriculaId,
      materiaId,
      periodoId,
      bloque1: fila.bloque1.map(normalizarNotaEntrada),
      bloque2: fila.bloque2.map(normalizarNotaEntrada),
      refuerzo: normalizarNotaEntrada(fila.refuerzo),
      proyecto: normalizarNotaEntrada(fila.proyecto),
      examen: normalizarNotaEntrada(fila.examen),
      version: fila.version,
    }));

    try {
      const actualizados = await servicioCalificacionesApi.guardarLote(solicitudes);
      const mapaActualizados = new Map(
        actualizados.map((reg) => [reg.matriculaId, reg]),
      );
      setFilas((previas) =>
        previas.map((fila) => {
          const remoto = mapaActualizados.get(fila.matriculaId);
          if (remoto) {
            return mapearRegistroAFila(remoto);
          }
          return fila.modificada ? { ...fila, modificada: false } : fila;
        }),
      );
      setMensajeExito(
        `Libreta guardada correctamente (${filasAGuardar.length} ${filasAGuardar.length === 1 ? 'estudiante actualizado' : 'estudiantes actualizados'}).`,
      );
    } catch {
      setMensajeError(
        'No se pudo sincronizar con el servidor académico. Verifica tu conexión e intenta nuevamente.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      data-testid="pantalla-libreta-calificaciones"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Libreta de calificaciones · RF-17, RF-18
          </span>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" aria-hidden="true" />
            Libreta de Calificaciones
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Registro de aportes por bloque (70 %), refuerzo académico, proyecto (15 %) y examen (15 %) con cálculo oficial truncado a 2 decimales y escala cualitativa A+ a E-.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              cargarLibreta().catch(() => undefined);
            }}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
            Recargar
          </button>

          <button
            type="button"
            onClick={restablecerEjemplo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restablecer
          </button>

          <button
            type="button"
            data-testid="boton-guardar-libreta"
            onClick={() => {
              guardarLibreta().catch(() => undefined);
            }}
            disabled={guardando || trimestreCerrado || hayErroresValidacion}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {guardando
              ? 'Guardando…'
              : cambiosPendientes > 0
                ? `Guardar libreta (${cambiosPendientes})`
                : 'Guardar libreta'}
          </button>
        </div>
      </header>

      {/* Selectores de contexto académico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <label htmlFor="selector-anio-libreta" className="block text-xs font-semibold text-slate-700 mb-1">
            Año lectivo
          </label>
          <select
            id="selector-anio-libreta"
            value={anioId}
            onChange={(e) => {
              manejarCambioAnio(e.target.value).catch(() => undefined);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            {anios.map((anio) => (
              <option key={anio.id} value={anio.id}>
                {anio.nombre} {anio.activo ? '(Activo)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="selector-periodo-libreta" className="block text-xs font-semibold text-slate-700 mb-1">
            Trimestre / Periodo
          </label>
          <select
            id="selector-periodo-libreta"
            value={periodoId}
            onChange={(e) => setPeriodoId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            {periodos.map((per) => (
              <option key={per.id} value={per.id}>
                Trimestre {per.numero} {per.cerrado ? '· Cerrado' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="selector-curso-libreta" className="block text-xs font-semibold text-slate-700 mb-1">
            Curso y paralelo
          </label>
          <select
            id="selector-curso-libreta"
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
          <label htmlFor="selector-materia-libreta" className="block text-xs font-semibold text-slate-700 mb-1">
            Asignatura
          </label>
          <select
            id="selector-materia-libreta"
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
      </div>

      {/* Avisos de estado, bloqueo RN-18, validación o guardado */}
      {trimestreCerrado && (
        <div
          data-testid="aviso-trimestre-cerrado"
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center gap-2 font-semibold"
        >
          <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
          Trimestre cerrado — La edición y el guardado de calificaciones están bloqueados (RN-18).
        </div>
      )}

      {hayErroresValidacion && (
        <div
          data-testid="aviso-error-validacion"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Existen notas fuera del rango permitido (0.00 a 10.00). Corrige las celdas marcadas en rojo.
        </div>
      )}

      {mensajeExito && (
        <div
          data-testid="aviso-guardado-exitoso"
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2 font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          data-testid="aviso-error-guardado"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </div>
      )}

      {modoDemo && (
        <p className="text-[11px] text-slate-500">
          Modo demostrativo local activo (sin registros remotos cargados para el filtro actual). Puedes editar aportes, revisar cálculos y ver libretas individuales.
        </p>
      )}

      {/* Tarjetas de resumen del curso */}
      <div
        data-testid="resumen-libreta-curso"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs text-slate-500">
            Trimestre {periodoActual?.numero ?? 1} · Calificados
          </p>
          <p className="text-xl font-bold text-slate-900">
            {resumenCurso.calificados} / {resumenCurso.totalEstudiantes}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5">
          <p className="text-xs text-indigo-700">Promedio del curso</p>
          <p
            data-testid="promedio-general-curso"
            className="text-xl font-bold text-indigo-900"
          >
            {formatearDecimal(resumenCurso.promedioCurso)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-xs text-amber-800">En refuerzo (&lt; 7,00)</p>
          <p className="text-xl font-bold text-amber-900">
            {resumenCurso.requierenRefuerzo}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <p className="text-xs text-emerald-800">Estándares (DA / AA / PA / NA)</p>
          <p className="text-sm font-bold text-emerald-900 mt-1">
            {resumenCurso.conteo.DA} / {resumenCurso.conteo.AA} /{' '}
            {resumenCurso.conteo.PA} / {resumenCurso.conteo.NA}
          </p>
        </div>
      </div>

      {/* Barra de búsqueda, filtro de estado y alta rápida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              data-testid="filtro-busqueda-estudiante"
              aria-label="Buscar estudiante en libreta"
              placeholder="Buscar estudiante…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white w-56"
            />
          </div>

          <select
            data-testid="filtro-estado-libreta"
            aria-label="Filtrar estudiantes por estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstadoLibreta)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="TODOS">Todos los estudiantes</option>
            <option value="REFUERZO">Requieren refuerzo (&lt; 7,00)</option>
            <option value="INCOMPLETOS">Sin nota final</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Nombre de nuevo estudiante"
            placeholder="Nombre del estudiante…"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            disabled={trimestreCerrado}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs w-52 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={agregarFilaEstudiante}
            disabled={trimestreCerrado}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Agregar estudiante
          </button>
        </div>
      </div>

      {/* Tabla principal de la libreta */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-slate-100 border-b border-slate-200 z-10">
                Estudiante
              </th>
              {CAMPOS_BLOQUE_1.map((campo) => (
                <th
                  key={campo.clave}
                  className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap"
                >
                  {campo.etiqueta}
                </th>
              ))}
              <th className="px-2 py-2.5 font-semibold text-center bg-slate-200/70 border-b border-slate-200 whitespace-nowrap">
                Prom. B1
              </th>
              {CAMPOS_BLOQUE_2.map((campo) => (
                <th
                  key={campo.clave}
                  className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap"
                >
                  {campo.etiqueta}
                </th>
              ))}
              <th className="px-2 py-2.5 font-semibold text-center bg-slate-200/70 border-b border-slate-200 whitespace-nowrap">
                Prom. B2
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Prom. Gral
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Refuerzo
              </th>
              <th className="px-2 py-2.5 font-semibold text-center bg-indigo-50 text-indigo-900 border-b border-slate-200 whitespace-nowrap">
                70 %
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Proyecto
              </th>
              <th className="px-2 py-2.5 font-semibold text-center bg-indigo-50 text-indigo-900 border-b border-slate-200 whitespace-nowrap">
                15 % Proy.
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Examen
              </th>
              <th className="px-2 py-2.5 font-semibold text-center bg-indigo-50 text-indigo-900 border-b border-slate-200 whitespace-nowrap">
                15 % Exam.
              </th>
              <th className="px-3 py-2.5 font-bold text-center bg-indigo-100 text-indigo-950 border-b border-slate-200 whitespace-nowrap">
                Nota Final
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Cualitativo
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Estándar
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Estado
              </th>
              <th className="px-2 py-2.5 font-semibold text-center border-b border-slate-200 whitespace-nowrap">
                Libreta
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {filasVisibles.length === 0 ? (
              <tr>
                <td
                  colSpan={24}
                  className="px-4 py-8 text-center text-slate-500 text-xs"
                >
                  No hay estudiantes que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              filasVisibles.map((fila) => {
                const calculo = calculosPorId.get(fila.id)!;
                return (
                  <tr key={fila.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-semibold text-slate-900 sticky left-0 bg-white border-r border-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{fila.nombreEstudiante}</span>
                        {fila.modificada && (
                          <span
                            title="Cambio sin guardar"
                            className="inline-block w-2 h-2 rounded-full bg-indigo-500"
                          />
                        )}
                      </div>
                    </td>

                    {CAMPOS_BLOQUE_1.map((campo, idxCampo) => {
                      const valor = fila.bloque1[idxCampo] ?? '';
                      const valido = esTextoNotaValido(valor);
                      return (
                        <td key={campo.clave} className="px-1.5 py-1.5 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={trimestreCerrado}
                            aria-invalid={!valido}
                            aria-label={`${fila.nombreEstudiante} - ${campo.etiqueta}`}
                            value={valor}
                            onChange={(e) =>
                              actualizarAporte(fila.id, 'bloque1', idxCampo, e.target.value)
                            }
                            className={`w-14 rounded-lg border px-1.5 py-1 text-center focus:outline-none focus:ring-2 ${
                              valido
                                ? 'border-slate-300 focus:ring-indigo-500'
                                : 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                            } disabled:bg-slate-100`}
                          />
                        </td>
                      );
                    })}

                    <td
                      data-testid={`prom-b1-${fila.id}`}
                      className="px-2 py-2 text-center font-semibold bg-slate-100/80 text-slate-800"
                    >
                      {formatearDecimal(calculo.promedioBloque1)}
                    </td>

                    {CAMPOS_BLOQUE_2.map((campo, idxCampo) => {
                      const valor = fila.bloque2[idxCampo] ?? '';
                      const valido = esTextoNotaValido(valor);
                      return (
                        <td key={campo.clave} className="px-1.5 py-1.5 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={trimestreCerrado}
                            aria-invalid={!valido}
                            aria-label={`${fila.nombreEstudiante} - ${campo.etiqueta}`}
                            value={valor}
                            onChange={(e) =>
                              actualizarAporte(fila.id, 'bloque2', idxCampo, e.target.value)
                            }
                            className={`w-14 rounded-lg border px-1.5 py-1 text-center focus:outline-none focus:ring-2 ${
                              valido
                                ? 'border-slate-300 focus:ring-indigo-500'
                                : 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                            } disabled:bg-slate-100`}
                          />
                        </td>
                      );
                    })}

                    <td
                      data-testid={`prom-b2-${fila.id}`}
                      className="px-2 py-2 text-center font-semibold bg-slate-100/80 text-slate-800"
                    >
                      {formatearDecimal(calculo.promedioBloque2)}
                    </td>

                    <td className="px-2 py-2 text-center font-medium text-slate-700">
                      {formatearDecimal(calculo.promedioGeneral)}
                    </td>

                    <td className="px-1.5 py-1.5 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={trimestreCerrado}
                        aria-invalid={!esTextoNotaValido(fila.refuerzo)}
                        aria-label={`${fila.nombreEstudiante} - Refuerzo`}
                        value={fila.refuerzo}
                        placeholder="—"
                        onChange={(e) =>
                          actualizarCampoSimple(fila.id, 'refuerzo', e.target.value)
                        }
                        className={`w-14 rounded-lg border px-1.5 py-1 text-center focus:outline-none focus:ring-2 ${
                          esTextoNotaValido(fila.refuerzo)
                            ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-500'
                            : 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        } disabled:bg-slate-100`}
                      />
                    </td>

                    <td
                      data-testid={`comp-70-${fila.id}`}
                      className="px-2 py-2 text-center font-semibold bg-indigo-50/60 text-indigo-900"
                    >
                      {formatearDecimal(calculo.componente70)}
                    </td>

                    <td className="px-1.5 py-1.5 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={trimestreCerrado}
                        aria-invalid={!esTextoNotaValido(fila.proyecto)}
                        aria-label={`${fila.nombreEstudiante} - Proyecto`}
                        value={fila.proyecto}
                        onChange={(e) =>
                          actualizarCampoSimple(fila.id, 'proyecto', e.target.value)
                        }
                        className={`w-14 rounded-lg border px-1.5 py-1 text-center focus:outline-none focus:ring-2 ${
                          esTextoNotaValido(fila.proyecto)
                            ? 'border-slate-300 focus:ring-indigo-500'
                            : 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        } disabled:bg-slate-100`}
                      />
                    </td>

                    <td className="px-2 py-2 text-center font-semibold bg-indigo-50/60 text-indigo-900">
                      {formatearDecimal(calculo.componenteProyecto15)}
                    </td>

                    <td className="px-1.5 py-1.5 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={trimestreCerrado}
                        aria-invalid={!esTextoNotaValido(fila.examen)}
                        aria-label={`${fila.nombreEstudiante} - Examen`}
                        value={fila.examen}
                        onChange={(e) =>
                          actualizarCampoSimple(fila.id, 'examen', e.target.value)
                        }
                        className={`w-14 rounded-lg border px-1.5 py-1 text-center focus:outline-none focus:ring-2 ${
                          esTextoNotaValido(fila.examen)
                            ? 'border-slate-300 focus:ring-indigo-500'
                            : 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        } disabled:bg-slate-100`}
                      />
                    </td>

                    <td className="px-2 py-2 text-center font-semibold bg-indigo-50/60 text-indigo-900">
                      {formatearDecimal(calculo.componenteExamen15)}
                    </td>

                    <td
                      data-testid={`nota-final-${fila.id}`}
                      className="px-3 py-2 text-center font-bold bg-indigo-50 text-indigo-950"
                    >
                      {formatearDecimal(calculo.notaFinal)}
                    </td>

                    <td className="px-2 py-2 text-center">
                      <span
                        data-testid={`cualitativo-${fila.id}`}
                        className={`inline-block px-2 py-0.5 rounded-full font-bold ${claseBadgeCualitativo(calculo.cualitativo)}`}
                      >
                        {calculo.cualitativo ?? '—'}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-center whitespace-nowrap text-slate-700 font-medium">
                      {calculo.estandar ? ETIQUETAS_ESTANDAR[calculo.estandar] : '—'}
                    </td>

                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {calculo.notaFinal === null ? (
                        <span className="text-slate-400">Pendiente</span>
                      ) : calculo.alertaPromedioBajo ? (
                        <span
                          data-testid={`alerta-promedio-bajo-${fila.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold"
                        >
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          Alerta &lt; 7,00
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          Al día
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        data-testid={`boton-ver-libreta-${fila.id}`}
                        onClick={() => setFilaDetalleId(fila.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1 font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Libreta Individual del Estudiante */}
      {filaDetalle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-libreta-individual"
          data-testid="modal-libreta-individual"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {(() => {
              const calc = calculosPorId.get(filaDetalle.id)!;
              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full mb-1">
                        <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        Libreta individual · Trimestre {periodoActual?.numero ?? 1}
                      </span>
                      <h3
                        id="titulo-libreta-individual"
                        className="text-xl font-bold text-slate-900"
                      >
                        {filaDetalle.nombreEstudiante}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cursoActual ? `${cursoActual.nivel} "${cursoActual.paralelo}"` : 'Curso'} ·{' '}
                        {materiaActual ? `${materiaActual.codigo} – ${materiaActual.nombre}` : 'Asignatura'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cerrar libreta individual"
                      onClick={() => setFilaDetalleId(null)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Bloque 1
                        </h4>
                        <span className="text-xs font-bold text-indigo-700">
                          Prom: {formatearDecimal(calc.promedioBloque1)}
                        </span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {CAMPOS_BLOQUE_1.map((c, idx) => (
                          <li key={c.clave} className="flex justify-between">
                            <span>{c.etiqueta}</span>
                            <strong className="text-slate-900">
                              {filaDetalle.bloque1[idx] || '—'}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Bloque 2
                        </h4>
                        <span className="text-xs font-bold text-indigo-700">
                          Prom: {formatearDecimal(calc.promedioBloque2)}
                        </span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {CAMPOS_BLOQUE_2.map((c, idx) => (
                          <li key={c.clave} className="flex justify-between">
                            <span>{c.etiqueta}</span>
                            <strong className="text-slate-900">
                              {filaDetalle.bloque2[idx] || '—'}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Refuerzo</span>
                      <strong className="text-slate-900 text-sm">
                        {filaDetalle.refuerzo || 'No aplica'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">70 % Bloques</span>
                      <strong className="text-indigo-800 text-sm">
                        {formatearDecimal(calc.componente70)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">15 % Proyecto</span>
                      <strong className="text-indigo-800 text-sm">
                        {formatearDecimal(calc.componenteProyecto15)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">15 % Examen</span>
                      <strong className="text-indigo-800 text-sm">
                        {formatearDecimal(calc.componenteExamen15)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                    <div>
                      <span className="text-xs font-semibold text-indigo-700">
                        Calificación Trimestral Final
                      </span>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          data-testid="detalle-nota-final"
                          className="text-2xl font-extrabold text-indigo-950"
                        >
                          {formatearDecimal(calc.notaFinal)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${claseBadgeCualitativo(calc.cualitativo)}`}
                        >
                          {calc.cualitativo ?? '—'}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {calc.estandar ? ETIQUETAS_ESTANDAR[calc.estandar] : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs font-semibold">
                      {calc.alertaPromedioBajo ? (
                        <span className="text-rose-700">
                          Observación: Requiere refuerzo académico (&lt; 7,00)
                        </span>
                      ) : calc.notaFinal !== null ? (
                        <span className="text-emerald-700">
                          Observación: Desempeño dentro del estándar esperado
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Observación: Calificaciones pendientes
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFilaDetalleId(null)}
                      className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Cerrar libreta
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
