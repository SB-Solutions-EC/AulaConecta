import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCheck,
  CheckCircle2,
  HeartHandshake,
  RefreshCw,
  Save,
  Search,
  Users,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type Curso,
} from '../api/academicoConfigApi';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  servicioComportamientoApi,
  type ClaveIndicadorComportamiento,
  type CualitativoComportamiento,
  type EscalaComportamiento,
  type IndicadoresComportamiento,
  type RegistroComportamiento,
} from '../api/comportamientoApi';

export interface IndicadorDefinicion {
  clave: ClaveIndicadorComportamiento;
  grupo: 'COGNITIVO' | 'SOCIAL';
  enunciado: string;
}

export interface EscalaDefinicion {
  valor: EscalaComportamiento;
  etiqueta: string;
  puntaje: number;
}

export interface ResultadoCalculoComportamiento {
  completados: number;
  total: number;
  completo: boolean;
  nota: number | null;
  cualitativo: CualitativoComportamiento | null;
  etiqueta: string | null;
  descripcion: string | null;
}

export interface FilaComportamiento {
  id?: string;
  matriculaId: string;
  estudianteId: string;
  nombreEstudiante: string;
  indicadores: IndicadoresComportamiento;
  version: number;
  modificada: boolean;
}

export interface PropiedadesPantallaComportamiento {
  filasIniciales?: ReadonlyArray<FilaComportamiento>;
  cursosIniciales?: ReadonlyArray<Curso>;
  trimestreInicial?: 1 | 2 | 3;
  omitirCargaRemota?: boolean;
}

export const INDICADORES_COMPORTAMIENTO: ReadonlyArray<IndicadorDefinicion> = [
  {
    clave: 'cog1',
    grupo: 'COGNITIVO',
    enunciado: 'Elabora el trabajo de forma independiente',
  },
  {
    clave: 'cog2',
    grupo: 'COGNITIVO',
    enunciado: 'Sigue instrucciones y cumple las actividades asignadas',
  },
  {
    clave: 'cog3',
    grupo: 'COGNITIVO',
    enunciado: 'Mantiene sus materiales y entorno de trabajo organizados',
  },
  {
    clave: 'cog4',
    grupo: 'COGNITIVO',
    enunciado: 'Demuestra interés y participa activamente en clase',
  },
  {
    clave: 'soc1',
    grupo: 'SOCIAL',
    enunciado: 'Respeta y considera a sus compañeros y docentes',
  },
  {
    clave: 'soc2',
    grupo: 'SOCIAL',
    enunciado: 'Colabora y trabaja en equipo de manera constructiva',
  },
  {
    clave: 'soc3',
    grupo: 'SOCIAL',
    enunciado: 'Cumple normas de convivencia dentro del aula e institución',
  },
  {
    clave: 'soc4',
    grupo: 'SOCIAL',
    enunciado: 'Resuelve desacuerdos mediante el diálogo respetuoso',
  },
  {
    clave: 'soc5',
    grupo: 'SOCIAL',
    enunciado: 'Cuida las instalaciones y bienes comunes de la institución',
  },
];

export const ESCALAS_COMPORTAMIENTO: ReadonlyArray<EscalaDefinicion> = [
  { valor: 'SIEMPRE', etiqueta: 'Siempre', puntaje: 10 },
  { valor: 'FRECUENTEMENTE', etiqueta: 'Frecuentemente', puntaje: 8 },
  { valor: 'OCASIONALMENTE', etiqueta: 'Ocasionalmente', puntaje: 6 },
  { valor: 'NUNCA', etiqueta: 'Nunca', puntaje: 2 },
];

const PUNTAJE_POR_ESCALA: Record<EscalaComportamiento, number> = {
  SIEMPRE: 10,
  FRECUENTEMENTE: 8,
  OCASIONALMENTE: 6,
  NUNCA: 2,
};

const TRAMOS_CUALITATIVOS: ReadonlyArray<{
  min: number;
  cualitativo: CualitativoComportamiento;
  etiqueta: string;
  descripcion: string;
}> = [
  {
    min: 9.0,
    cualitativo: 'A',
    etiqueta: 'Muy satisfactorio',
    descripcion:
      'Lidera el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 7.5,
    cualitativo: 'B',
    etiqueta: 'Satisfactorio',
    descripcion:
      'Cumple con los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 6.0,
    cualitativo: 'C',
    etiqueta: 'Poco satisfactorio',
    descripcion:
      'Falla ocasionalmente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 4.0,
    cualitativo: 'D',
    etiqueta: 'Mejorable',
    descripcion:
      'Falla reiteradamente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 0,
    cualitativo: 'E',
    etiqueta: 'Insatisfactorio',
    descripcion:
      'No cumple con los compromisos establecidos para la sana convivencia social.',
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

const FILAS_DEMO_COMPORTAMIENTO: ReadonlyArray<FilaComportamiento> = [
  {
    id: 'comp-demo-1',
    matriculaId: 'matr-1',
    estudianteId: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    indicadores: {
      cog1: 'SIEMPRE',
      cog2: 'SIEMPRE',
      cog3: 'SIEMPRE',
      cog4: 'SIEMPRE',
      soc1: 'SIEMPRE',
      soc2: 'SIEMPRE',
      soc3: 'SIEMPRE',
      soc4: 'SIEMPRE',
      soc5: 'SIEMPRE',
    },
    version: 1,
    modificada: false,
  },
  {
    id: 'comp-demo-2',
    matriculaId: 'matr-2',
    estudianteId: 'est-2',
    nombreEstudiante: 'Simulado Bruno',
    indicadores: {
      cog1: 'FRECUENTEMENTE',
      cog2: 'OCASIONALMENTE',
      cog3: 'OCASIONALMENTE',
      cog4: 'FRECUENTEMENTE',
      soc1: 'OCASIONALMENTE',
      soc2: 'OCASIONALMENTE',
      soc3: 'OCASIONALMENTE',
      soc4: 'OCASIONALMENTE',
      soc5: 'OCASIONALMENTE',
    },
    version: 1,
    modificada: false,
  },
  {
    id: 'comp-demo-3',
    matriculaId: 'matr-3',
    estudianteId: 'est-3',
    nombreEstudiante: 'Inventada Camila',
    indicadores: {
      cog1: 'FRECUENTEMENTE',
      cog2: 'FRECUENTEMENTE',
      cog3: 'SIEMPRE',
      soc1: 'FRECUENTEMENTE',
      soc2: 'SIEMPRE',
    },
    version: 0,
    modificada: false,
  },
];

export function calcularComportamiento(
  indicadores: IndicadoresComportamiento,
): ResultadoCalculoComportamiento {
  let suma = 0;
  let completados = 0;

  for (const ind of INDICADORES_COMPORTAMIENTO) {
    const valor = indicadores[ind.clave];
    if (valor) {
      suma += PUNTAJE_POR_ESCALA[valor];
      completados += 1;
    }
  }

  const total = INDICADORES_COMPORTAMIENTO.length;
  if (completados === 0) {
    return {
      completados: 0,
      total,
      completo: false,
      nota: null,
      cualitativo: null,
      etiqueta: null,
      descripcion: null,
    };
  }

  const promedio = suma / completados;
  const nota = Math.trunc(promedio * 100 + 1e-9) / 100;
  const tramo =
    TRAMOS_CUALITATIVOS.find((t) => nota >= t.min) ??
    TRAMOS_CUALITATIVOS[TRAMOS_CUALITATIVOS.length - 1];

  return {
    completados,
    total,
    completo: completados === total,
    nota,
    cualitativo: tramo.cualitativo,
    etiqueta: tramo.etiqueta,
    descripcion: tramo.descripcion,
  };
}

function claseBadgeCualitativo(
  cualitativo: CualitativoComportamiento | null,
): string {
  switch (cualitativo) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'B':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'C':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'D':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'E':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function clonarFilas(
  filas: ReadonlyArray<FilaComportamiento>,
): FilaComportamiento[] {
  return filas.map((fila) => ({
    ...fila,
    indicadores: { ...fila.indicadores },
  }));
}

function mapearRegistroAFila(reg: RegistroComportamiento): FilaComportamiento {
  return {
    id: reg.id,
    matriculaId: reg.matriculaId,
    estudianteId: reg.estudianteId ?? reg.matriculaId,
    nombreEstudiante:
      reg.nombreEstudiante?.trim() || `Estudiante ${reg.matriculaId}`,
    indicadores: { ...reg.indicadores },
    version: reg.version,
    modificada: false,
  };
}

function sonIndicadoresCompletos(
  indicadores: IndicadoresComportamiento,
): indicadores is Record<ClaveIndicadorComportamiento, EscalaComportamiento> {
  return INDICADORES_COMPORTAMIENTO.every((ind) => Boolean(indicadores[ind.clave]));
}

export function PantallaComportamiento({
  filasIniciales = FILAS_DEMO_COMPORTAMIENTO,
  cursosIniciales = CATALOGO_DEMO_CURSOS,
  trimestreInicial = 1,
  omitirCargaRemota = false,
}: Readonly<PropiedadesPantallaComportamiento>) {
  const [cursos, setCursos] = useState<Curso[]>(() => [...cursosIniciales]);
  const [cursoId, setCursoId] = useState<string>(
    () => cursosIniciales[0]?.id ?? '',
  );
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(trimestreInicial);

  const [filas, setFilas] = useState<FilaComportamiento[]>(() =>
    clonarFilas(filasIniciales),
  );
  const [matriculaSeleccionada, setMatriculaSeleccionada] = useState<string>(
    () => filasIniciales[0]?.matriculaId ?? '',
  );
  const [busqueda, setBusqueda] = useState<string>('');

  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const cargarCatalogosYComportamiento = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    setCargando(true);
    try {
      const [cursosApi, registrosApi] = await Promise.all([
        servicioAcademicoConfigApi.listarCursos().catch(() => []),
        servicioComportamientoApi
          .listarComportamientos({ trimestre })
          .catch(() => []),
      ]);

      if (cursosApi.length > 0) {
        setCursos(cursosApi);
        setCursoId((prev) => prev || cursosApi[0].id);
      }
      if (registrosApi.length > 0) {
        const mapeadas = registrosApi.map(mapearRegistroAFila);
        setFilas(mapeadas);
        setMatriculaSeleccionada((prev) =>
          mapeadas.some((f) => f.matriculaId === prev)
            ? prev
            : (mapeadas[0]?.matriculaId ?? ''),
        );
      }
    } finally {
      setCargando(false);
    }
  }, [omitirCargaRemota, trimestre]);

  useEffect(() => {
    cargarCatalogosYComportamiento().catch(() => undefined);
  }, [cargarCatalogosYComportamiento]);

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) {
      return filas;
    }
    return filas.filter((f) =>
      f.nombreEstudiante.toLowerCase().includes(termino),
    );
  }, [busqueda, filas]);

  const filaActiva = useMemo(
    () =>
      filas.find((f) => f.matriculaId === matriculaSeleccionada) ??
      filas[0] ??
      null,
    [filas, matriculaSeleccionada],
  );

  const resultadoActivo = useMemo(
    () =>
      filaActiva ? calcularComportamiento(filaActiva.indicadores) : null,
    [filaActiva],
  );

  const resumenCurso = useMemo(() => {
    const conteo: Record<CualitativoComportamiento, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
    };
    let completos = 0;

    for (const fila of filas) {
      const res = calcularComportamiento(fila.indicadores);
      if (res.completo) {
        completos += 1;
      }
      if (res.cualitativo) {
        conteo[res.cualitativo] += 1;
      }
    }

    return {
      total: filas.length,
      completos,
      conteo,
    };
  }, [filas]);

  const indicadoresCognitivos = useMemo(
    () => INDICADORES_COMPORTAMIENTO.filter((i) => i.grupo === 'COGNITIVO'),
    [],
  );
  const indicadoresSociales = useMemo(
    () => INDICADORES_COMPORTAMIENTO.filter((i) => i.grupo === 'SOCIAL'),
    [],
  );

  const actualizarIndicador = (
    clave: ClaveIndicadorComportamiento,
    escala: EscalaComportamiento,
  ) => {
    if (!filaActiva) {
      return;
    }
    setMensajeError(null);
    setMensajeExito(null);

    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === filaActiva.matriculaId
          ? {
              ...fila,
              indicadores: {
                ...fila.indicadores,
                [clave]: escala,
              },
              modificada: true,
            }
          : fila,
      ),
    );
  };

  const manejarAplicarTodosSiempre = () => {
    if (!filaActiva) {
      return;
    }
    setMensajeError(null);
    setMensajeExito(null);

    const todosSiempre: IndicadoresComportamiento = {};
    for (const ind of INDICADORES_COMPORTAMIENTO) {
      todosSiempre[ind.clave] = 'SIEMPRE';
    }

    setFilas((prev) =>
      prev.map((fila) =>
        fila.matriculaId === filaActiva.matriculaId
          ? {
              ...fila,
              indicadores: todosSiempre,
              modificada: true,
            }
          : fila,
      ),
    );
  };

  const manejarGuardarComportamiento = async () => {
    if (!filaActiva || !resultadoActivo) {
      return;
    }
    setMensajeError(null);
    setMensajeExito(null);

    if (!sonIndicadoresCompletos(filaActiva.indicadores)) {
      setMensajeError(
        `Completa los 9 indicadores de comportamiento de ${filaActiva.nombreEstudiante} antes de guardar (${resultadoActivo.completados}/9).`,
      );
      return;
    }

    setGuardando(true);
    try {
      let actualizada: FilaComportamiento;
      if (omitirCargaRemota) {
        actualizada = {
          ...filaActiva,
          version: filaActiva.version + 1,
          modificada: false,
        };
      } else {
        try {
          const respuesta =
            await servicioComportamientoApi.guardarComportamiento({
              id: filaActiva.id,
              matriculaId: filaActiva.matriculaId,
              trimestre,
              indicadores: filaActiva.indicadores,
              version: filaActiva.version,
            });
          actualizada = mapearRegistroAFila(respuesta);
        } catch (error) {
          if (
            error instanceof ErrorHttpApi &&
            error.estado >= 400 &&
            error.estado < 500
          ) {
            setMensajeError(error.message);
            return;
          }
          actualizada = {
            ...filaActiva,
            version: filaActiva.version + 1,
            modificada: false,
          };
        }
      }

      setFilas((prev) =>
        prev.map((fila) =>
          fila.matriculaId === filaActiva.matriculaId ? actualizada : fila,
        ),
      );
      setMensajeExito(
        `Comportamiento de ${filaActiva.nombreEstudiante} guardado con cualitativo ${resultadoActivo.cualitativo} (${resultadoActivo.nota?.toFixed(2)}).`,
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      data-testid="pantalla-comportamiento"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 lg:p-8 space-y-6"
    >
      {/* Cabecera */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Comportamiento estudiantil · RF-22 · 9 Indicadores
          </span>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HeartHandshake
              className="w-6 h-6 text-indigo-600"
              aria-hidden="true"
            />
            Registro de Comportamiento
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Evalúa los 4 indicadores cognitivos y 5 sociales en escala ministerial para calcular automáticamente la nota, el cualitativo y su descripción.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cargarCatalogosYComportamiento().catch(() => undefined);
          }}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50 self-start lg:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Actualizar registros
        </button>
      </header>

      {/* Selectores de curso, trimestre y resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <div>
          <label
            htmlFor="select-curso-comportamiento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Curso y paralelo
          </label>
          <select
            id="select-curso-comportamiento"
            data-testid="select-curso-comportamiento"
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
            htmlFor="select-trimestre-comportamiento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Trimestre
          </label>
          <select
            id="select-trimestre-comportamiento"
            data-testid="select-trimestre-comportamiento"
            value={trimestre}
            onChange={(e) => {
              setTrimestre(Number(e.target.value) as 1 | 2 | 3);
              setMensajeError(null);
              setMensajeExito(null);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            <option value={1}>Trimestre 1</option>
            <option value={2}>Trimestre 2</option>
            <option value={3}>Trimestre 3</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="input-buscar-estudiante-comportamiento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Buscar estudiante
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="input-buscar-estudiante-comportamiento"
              data-testid="input-buscar-estudiante-comportamiento"
              type="search"
              placeholder="Nombre del estudiante…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Resumen del curso */}
      <div
        data-testid="resumen-comportamiento"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
      >
        <div className="text-xs font-semibold text-slate-700">
          Evaluaciones completas:{' '}
          <strong className="text-slate-900">
            {resumenCurso.completos} / {resumenCurso.total}
          </strong>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['A', 'B', 'C', 'D', 'E'] as const).map((letra) => (
            <span
              key={letra}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${claseBadgeCualitativo(letra)}`}
            >
              {letra}: {resumenCurso.conteo[letra]}
            </span>
          ))}
        </div>
      </div>

      {mensajeExito && (
        <div
          data-testid="aviso-exito-comportamiento"
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2 font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          data-testid="aviso-error-comportamiento"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </div>
      )}

      {/* Cuerpo principal: nómina de estudiantes + panel de 9 indicadores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Nómina de estudiantes
          </h3>
          {filasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              No hay estudiantes que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="space-y-2">
              {filasFiltradas.map((fila) => {
                const res = calcularComportamiento(fila.indicadores);
                const seleccionado = filaActiva?.matriculaId === fila.matriculaId;
                return (
                  <button
                    key={fila.matriculaId}
                    type="button"
                    data-testid={`tarjeta-comportamiento-${fila.matriculaId}`}
                    onClick={() => {
                      setMatriculaSeleccionada(fila.matriculaId);
                      setMensajeError(null);
                      setMensajeExito(null);
                    }}
                    className={`w-full text-left rounded-2xl border p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                      seleccionado
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {fila.nombreEstudiante}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${claseBadgeCualitativo(res.cualitativo)}`}
                      >
                        {res.cualitativo ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Indicadores: {res.completados}/{res.total}
                        {fila.modificada ? ' · Sin guardar' : ''}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {res.nota !== null ? `${res.nota.toFixed(2)} / 10` : 'Pendiente'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {filaActiva && resultadoActivo && (
          <div
            data-testid="panel-evaluacion-comportamiento"
            className="lg:col-span-8 space-y-5"
          >
            {/* Resultado en tiempo real */}
            <div
              data-testid="resultado-comportamiento-actual"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    Evaluación de <strong>{filaActiva.nombreEstudiante}</strong> · Trimestre {trimestre}
                  </p>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="text-2xl font-bold text-slate-900">
                      {resultadoActivo.nota !== null
                        ? `${resultadoActivo.nota.toFixed(2)} / 10`
                        : '—'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${claseBadgeCualitativo(resultadoActivo.cualitativo)}`}
                    >
                      {resultadoActivo.cualitativo
                        ? `${resultadoActivo.cualitativo} · ${resultadoActivo.etiqueta}`
                        : 'Sin evaluar'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="boton-aplicar-siempre"
                  onClick={manejarAplicarTodosSiempre}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Marcar todos &ldquo;Siempre&rdquo;
                </button>
              </div>

              {resultadoActivo.descripcion && (
                <p className="text-xs text-slate-700 bg-white rounded-xl border border-slate-200 px-3 py-2">
                  {resultadoActivo.descripcion}
                </p>
              )}
            </div>

            {/* Indicadores cognitivos (4) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Brain className="w-4 h-4" aria-hidden="true" />
                Indicadores cognitivos (4)
              </h3>
              <div className="space-y-2.5">
                {indicadoresCognitivos.map((ind, idx) => (
                  <GrupoIndicador
                    key={ind.clave}
                    indice={idx + 1}
                    indicador={ind}
                    valorSeleccionado={filaActiva.indicadores[ind.clave]}
                    alSeleccionar={(escala) =>
                      actualizarIndicador(ind.clave, escala)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Indicadores sociales (5) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Users className="w-4 h-4" aria-hidden="true" />
                Indicadores sociales (5)
              </h3>
              <div className="space-y-2.5">
                {indicadoresSociales.map((ind, idx) => (
                  <GrupoIndicador
                    key={ind.clave}
                    indice={idx + 5}
                    indicador={ind}
                    valorSeleccionado={filaActiva.indicadores[ind.clave]}
                    alSeleccionar={(escala) =>
                      actualizarIndicador(ind.clave, escala)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Guardar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Completados: {resultadoActivo.completados} de{' '}
                {resultadoActivo.total} indicadores
              </span>
              <button
                type="button"
                data-testid="boton-guardar-comportamiento"
                disabled={guardando}
                onClick={() => {
                  manejarGuardarComportamiento().catch(() => undefined);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {guardando ? 'Guardando…' : 'Guardar comportamiento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface PropiedadesGrupoIndicador {
  indice: number;
  indicador: IndicadorDefinicion;
  valorSeleccionado: EscalaComportamiento | undefined;
  alSeleccionar: (escala: EscalaComportamiento) => void;
}

function GrupoIndicador({
  indice,
  indicador,
  valorSeleccionado,
  alSeleccionar,
}: Readonly<PropiedadesGrupoIndicador>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5">
      <p className="text-xs sm:text-sm font-semibold text-slate-800">
        {indice}. {indicador.enunciado}
      </p>
      <div
        role="group"
        aria-label={indicador.enunciado}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {ESCALAS_COMPORTAMIENTO.map((escala) => {
          const activo = valorSeleccionado === escala.valor;
          return (
            <button
              key={escala.valor}
              type="button"
              data-testid={`ind-${indicador.clave}-${escala.valor}`}
              aria-pressed={activo}
              onClick={() => alSeleccionar(escala.valor)}
              className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activo
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {escala.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}
