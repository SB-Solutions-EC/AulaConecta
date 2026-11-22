import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  MessageSquareText,
  Send,
  X,
} from 'lucide-react';
import type { Materia } from '../api/academicoConfigApi';
import type {
  EntregaTarea,
  EstadoEntregaTarea,
  TareaAcademica,
  TipoActividadAcademica,
} from '../api/tareasApi';

export type CodigoEquivalenciaCualitativa = 'DA' | 'AA' | 'PA' | 'NA';

export interface EquivalenciaCualitativa {
  codigo: CodigoEquivalenciaCualitativa;
  etiqueta: string;
  claseBadge: string;
}

export interface ResumenEstudianteTareas {
  pendientes: number;
  entregadas: number;
  calificadas: number;
  promedioSobreDiez: number | null;
}

export interface PropiedadesVistaTareasEstudiante {
  tareas: ReadonlyArray<TareaAcademica>;
  tareasFiltradas: ReadonlyArray<TareaAcademica>;
  materias: ReadonlyArray<Materia>;
  mapaCursos: ReadonlyMap<string, string>;
  mapaMaterias: ReadonlyMap<string, string>;
  entregaPorTareaEstudiante: ReadonlyMap<string, EntregaTarea>;
  resumen: ResumenEstudianteTareas;
  filtroTipo: 'TODAS' | TipoActividadAcademica;
  filtroEstado: 'TODAS' | EstadoEntregaTarea;
  filtroMateria: 'TODAS' | string;
  alCambiarFiltroTipo: (tipo: 'TODAS' | TipoActividadAcademica) => void;
  alCambiarFiltroEstado: (estado: 'TODAS' | EstadoEntregaTarea) => void;
  alCambiarFiltroMateria: (materiaId: 'TODAS' | string) => void;
  alAbrirEntrega: (tarea: TareaAcademica, entrega?: EntregaTarea) => void;
}

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

function claseBarraProgreso(notaSobreDiez: number): string {
  if (notaSobreDiez >= 9.0) {
    return 'bg-emerald-500';
  }
  if (notaSobreDiez >= 7.0) {
    return 'bg-sky-500';
  }
  if (notaSobreDiez > 4.0) {
    return 'bg-amber-500';
  }
  return 'bg-rose-500';
}

export function normalizarNotaSobreDiez(
  calificacion: number,
  puntajeMaximo: number,
): number {
  if (
    !Number.isFinite(calificacion) ||
    !Number.isFinite(puntajeMaximo) ||
    puntajeMaximo <= 0
  ) {
    return 0;
  }
  return (calificacion / puntajeMaximo) * 10;
}

export function obtenerEquivalenciaCualitativa(
  notaSobreDiez: number,
): EquivalenciaCualitativa {
  if (notaSobreDiez >= 9.0) {
    return {
      codigo: 'DA',
      etiqueta: 'Domina los aprendizajes',
      claseBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (notaSobreDiez >= 7.0) {
    return {
      codigo: 'AA',
      etiqueta: 'Alcanza los aprendizajes',
      claseBadge: 'bg-sky-100 text-sky-800 border-sky-200',
    };
  }
  if (notaSobreDiez > 4.0) {
    return {
      codigo: 'PA',
      etiqueta: 'Próximo a alcanzar',
      claseBadge: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  return {
    codigo: 'NA',
    etiqueta: 'No alcanza los aprendizajes',
    claseBadge: 'bg-rose-100 text-rose-800 border-rose-200',
  };
}

export function VistaTareasEstudiante({
  tareas,
  tareasFiltradas,
  materias,
  mapaCursos,
  mapaMaterias,
  entregaPorTareaEstudiante,
  resumen,
  filtroTipo,
  filtroEstado,
  filtroMateria,
  alCambiarFiltroTipo,
  alCambiarFiltroEstado,
  alCambiarFiltroMateria,
  alAbrirEntrega,
}: Readonly<PropiedadesVistaTareasEstudiante>) {
  const [tareaDetalleId, setTareaDetalleId] = useState<string | null>(null);

  const tareaEnDetalle = useMemo(
    () => tareas.find((t) => t.id === tareaDetalleId) ?? null,
    [tareaDetalleId, tareas],
  );
  const entregaEnDetalle = useMemo(() => {
    if (!tareaEnDetalle) {
      return undefined;
    }
    return entregaPorTareaEstudiante.get(tareaEnDetalle.id);
  }, [entregaPorTareaEstudiante, tareaEnDetalle]);

  const detalleCalificado = useMemo(() => {
    if (
      !tareaEnDetalle ||
      !entregaEnDetalle ||
      entregaEnDetalle.estado !== 'CALIFICADA' ||
      entregaEnDetalle.calificacion === null
    ) {
      return null;
    }
    const notaSobreDiez = normalizarNotaSobreDiez(
      entregaEnDetalle.calificacion,
      tareaEnDetalle.puntajeMaximo,
    );
    return {
      tarea: tareaEnDetalle,
      entrega: entregaEnDetalle,
      calificacion: entregaEnDetalle.calificacion,
      notaSobreDiez,
      equivalencia: obtenerEquivalenciaCualitativa(notaSobreDiez),
      porcentaje: Math.max(0, Math.min(100, (notaSobreDiez / 10) * 100)),
    };
  }, [entregaEnDetalle, tareaEnDetalle]);
  const equivalenciaPromedio =
    resumen.promedioSobreDiez !== null
      ? obtenerEquivalenciaCualitativa(resumen.promedioSobreDiez)
      : null;

  const alternarFiltroEstado = (estadoObjetivo: EstadoEntregaTarea) => {
    alCambiarFiltroEstado(
      filtroEstado === estadoObjetivo ? 'TODAS' : estadoObjetivo,
    );
  };

  return (
    <div data-testid="vista-tareas-estudiante" className="space-y-5">
      {/* Tarjetas de resumen del estudiante (RF-20) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => alternarFiltroEstado('PENDIENTE')}
          aria-pressed={filtroEstado === 'PENDIENTE'}
          className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
            filtroEstado === 'PENDIENTE'
              ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-300'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
          }`}
        >
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="text-xl font-bold text-slate-900">
            {resumen.pendientes}
          </p>
        </button>

        <button
          type="button"
          onClick={() => alternarFiltroEstado('ENTREGADA')}
          aria-pressed={filtroEstado === 'ENTREGADA'}
          className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
            filtroEstado === 'ENTREGADA'
              ? 'border-indigo-500 bg-indigo-100/80 ring-2 ring-indigo-300'
              : 'border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/60'
          }`}
        >
          <p className="text-xs text-indigo-700">Entregadas</p>
          <p className="text-xl font-bold text-indigo-900">
            {resumen.entregadas}
          </p>
        </button>

        <button
          type="button"
          onClick={() => alternarFiltroEstado('CALIFICADA')}
          aria-pressed={filtroEstado === 'CALIFICADA'}
          className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
            filtroEstado === 'CALIFICADA'
              ? 'border-emerald-500 bg-emerald-100/80 ring-2 ring-emerald-300'
              : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60'
          }`}
        >
          <p className="text-xs text-emerald-800">Calificadas</p>
          <p className="text-xl font-bold text-emerald-900">
            {resumen.calificadas}
          </p>
        </button>

        <div
          data-testid="resumen-promedio-estudiante"
          className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 flex flex-col justify-between gap-1"
        >
          <p className="text-xs text-sky-800 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" aria-hidden="true" />
            Promedio calificadas
          </p>
          {resumen.promedioSobreDiez !== null && equivalenciaPromedio ? (
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-xl font-bold text-sky-950">
                {resumen.promedioSobreDiez.toFixed(2)} / 10
              </p>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${equivalenciaPromedio.claseBadge}`}
              >
                {equivalenciaPromedio.codigo}
              </span>
            </div>
          ) : (
            <div>
              <p className="text-xl font-bold text-sky-950">—</p>
              <p className="text-[11px] text-sky-700">Sin calificaciones aún</p>
            </div>
          )}
        </div>
      </div>

      {/* Barra de filtros para el estudiante */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="filtro-tipo-actividad"
            className="text-xs font-semibold text-slate-700"
          >
            Tipo:
          </label>
          <select
            id="filtro-tipo-actividad"
            data-testid="filtro-tipo-tareas"
            value={filtroTipo}
            onChange={(e) =>
              alCambiarFiltroTipo(
                e.target.value as 'TODAS' | TipoActividadAcademica,
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="TODAS">Todas las actividades</option>
            <option value="TAREA">Tareas</option>
            <option value="PRUEBA">Pruebas</option>
            <option value="PROYECTO">Proyectos</option>
          </select>

          <label
            htmlFor="filtro-estado-actividad"
            className="text-xs font-semibold text-slate-700 ml-2"
          >
            Estado:
          </label>
          <select
            id="filtro-estado-actividad"
            data-testid="filtro-estado-tareas-estudiante"
            value={filtroEstado}
            onChange={(e) =>
              alCambiarFiltroEstado(
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

          <label
            htmlFor="filtro-materia-actividad"
            className="text-xs font-semibold text-slate-700 ml-2"
          >
            Asignatura:
          </label>
          <select
            id="filtro-materia-actividad"
            data-testid="filtro-materia-tareas-estudiante"
            value={filtroMateria}
            onChange={(e) => alCambiarFiltroMateria(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="TODAS">Todas las asignaturas</option>
            {materias.map((mat) => (
              <option key={mat.id} value={mat.id}>
                {mat.codigo} · {mat.nombre}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-500">
          {tareasFiltradas.length}{' '}
          {tareasFiltradas.length === 1 ? 'actividad' : 'actividades'}
        </span>
      </div>

      {/* Listado de tareas del estudiante */}
      {tareasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          No existen actividades registradas para el filtro seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tareasFiltradas.map((tarea) => {
            const entregaEst = entregaPorTareaEstudiante.get(tarea.id);
            const estadoEst: EstadoEntregaTarea =
              entregaEst?.estado ?? 'PENDIENTE';
            const calificacionNumerica =
              estadoEst === 'CALIFICADA' &&
              entregaEst !== undefined &&
              entregaEst.calificacion !== null
                ? entregaEst.calificacion
                : null;
            const notaSobreDiez =
              calificacionNumerica !== null
                ? normalizarNotaSobreDiez(
                    calificacionNumerica,
                    tarea.puntajeMaximo,
                  )
                : null;
            const equivalencia =
              notaSobreDiez !== null
                ? obtenerEquivalenciaCualitativa(notaSobreDiez)
                : null;
            const porcentaje =
              notaSobreDiez !== null
                ? Math.max(0, Math.min(100, (notaSobreDiez / 10) * 100))
                : 0;
            const requiereRefuerzo =
              notaSobreDiez !== null && notaSobreDiez < 7.0;

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
                      <ClipboardCheck
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                      Sobre {tarea.puntajeMaximo} pts
                    </span>
                  </div>

                  {equivalencia && notaSobreDiez !== null && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          data-testid={`equivalencia-tarea-${tarea.id}`}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${equivalencia.claseBadge}`}
                        >
                          {equivalencia.codigo} · {equivalencia.etiqueta}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {porcentaje.toFixed(0)}%
                        </span>
                      </div>

                      <div
                        role="progressbar"
                        aria-label={`Calificación obtenida en ${tarea.titulo}`}
                        aria-valuenow={Number(notaSobreDiez.toFixed(2))}
                        aria-valuemin={0}
                        aria-valuemax={10}
                        className="h-2 w-full rounded-full bg-slate-200 overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all ${claseBarraProgreso(notaSobreDiez)}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>

                      {requiereRefuerzo && (
                        <div
                          data-testid={`aviso-refuerzo-${tarea.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                        >
                          <AlertTriangle
                            className="w-3.5 h-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Requiere refuerzo
                        </div>
                      )}
                    </div>
                  )}

                  {estadoEst === 'CALIFICADA' &&
                    (entregaEst?.observacionDocente ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                        <strong>Observación docente:</strong>{' '}
                        {entregaEst.observacionDocente}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                        Sin retroalimentación escrita del docente.
                      </div>
                    ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {estadoEst === 'CALIFICADA' ? (
                    <button
                      type="button"
                      data-testid={`boton-ver-retroalimentacion-${tarea.id}`}
                      onClick={() => setTareaDetalleId(tarea.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Ver nota y retroalimentación
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid={`boton-abrir-entrega-${tarea.id}`}
                      onClick={() => alAbrirEntrega(tarea, entregaEst)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {estadoEst === 'ENTREGADA' ? (
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

      {/* Modal de detalle de calificación y retroalimentación (RF-20) */}
      {detalleCalificado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-retroalimentacion"
          data-testid="modal-retroalimentacion-estudiante"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Calificación · {ETIQUETAS_TIPO[detalleCalificado.tarea.tipo]}
                </span>
                <h3
                  id="titulo-modal-retroalimentacion"
                  className="text-lg font-bold text-slate-900 mt-1.5"
                >
                  {detalleCalificado.tarea.titulo}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mapaMaterias.get(detalleCalificado.tarea.materiaId) ??
                    'Asignatura'}{' '}
                  · {mapaCursos.get(detalleCalificado.tarea.cursoId) ?? 'Curso'}{' '}
                  · Fecha límite: {detalleCalificado.tarea.fechaEntrega}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle de calificación"
                onClick={() => setTareaDetalleId(null)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Bloque de nota y escala cualitativa */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Calificación obtenida
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {detalleCalificado.calificacion.toFixed(2)} /{' '}
                    {detalleCalificado.tarea.puntajeMaximo}
                  </p>
                  {detalleCalificado.tarea.puntajeMaximo !== 10 && (
                    <p className="text-[11px] text-slate-500">
                      Equivalente sobre 10:{' '}
                      {detalleCalificado.notaSobreDiez.toFixed(2)} / 10
                    </p>
                  )}
                </div>

                <div className="text-right space-y-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${detalleCalificado.equivalencia.claseBadge}`}
                  >
                    {detalleCalificado.equivalencia.codigo} ·{' '}
                    {detalleCalificado.equivalencia.etiqueta}
                  </span>
                  <p className="text-xs font-semibold text-slate-600">
                    {detalleCalificado.porcentaje.toFixed(0)}% del puntaje
                    máximo
                  </p>
                </div>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${claseBarraProgreso(detalleCalificado.notaSobreDiez)}`}
                  style={{ width: `${detalleCalificado.porcentaje}%` }}
                />
              </div>

              {detalleCalificado.notaSobreDiez < 7.0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center gap-2 font-semibold">
                  <AlertTriangle
                    className="w-4 h-4 shrink-0"
                    aria-hidden="true"
                  />
                  Requiere refuerzo académico: la calificación obtenida es menor
                  a 7.00 / 10.
                </div>
              )}
            </div>

            {/* Retroalimentación del docente */}
            <div
              data-testid="detalle-retroalimentacion-docente"
              className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5"
            >
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4" aria-hidden="true" />
                Retroalimentación del docente
              </h4>
              {detalleCalificado.entrega.observacionDocente ? (
                <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                  {detalleCalificado.entrega.observacionDocente}
                </p>
              ) : (
                <p className="text-xs text-slate-600 italic">
                  El docente no registró comentarios adicionales para esta
                  entrega.
                </p>
              )}
            </div>

            {/* Tu entrega registrada (texto plano sin enlaces ejecutables) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2
                  className="w-4 h-4 text-indigo-600"
                  aria-hidden="true"
                />
                Tu entrega registrada
              </h4>
              {detalleCalificado.entrega.fechaEntregaReal && (
                <p className="text-[11px] text-slate-500">
                  Fecha de envío: {detalleCalificado.entrega.fechaEntregaReal}
                </p>
              )}
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {detalleCalificado.entrega.comentario}
              </p>
              {detalleCalificado.entrega.enlaceAdjunto && (
                <p className="text-xs font-mono text-indigo-700 break-all">
                  Adjunto: {detalleCalificado.entrega.enlaceAdjunto}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setTareaDetalleId(null)}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
