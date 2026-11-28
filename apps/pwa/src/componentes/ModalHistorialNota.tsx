import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock,
  History,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  servicioAuditoriaNotasApi,
  type AccionAuditoria,
  type RegistroAuditoriaAcademica,
} from '../api/auditoriaNotasApi';

export interface DiferenciaCampoNota {
  campo: string;
  etiqueta: string;
  anterior: string;
  nuevo: string;
}

export interface PropiedadesModalHistorialNota {
  entidadId: string;
  nombreEstudiante: string;
  nombreMateria: string;
  trimestre: number;
  eventosIniciales?: ReadonlyArray<RegistroAuditoriaAcademica>;
  omitirCargaRemota?: boolean;
  alCerrar: () => void;
}

const ETIQUETAS_CAMPOS: Record<string, string> = {
  aportesBloque1: 'Aportes Bloque 1',
  aportesBloque2: 'Aportes Bloque 2',
  refuerzo: 'Refuerzo académico',
  notaProyecto: 'Proyecto integrador',
  notaExamen: 'Examen trimestral',
  notaFinal: 'Nota final',
  cualitativo: 'Cualitativo',
  estandar: 'Estándar de logro',
};

const ORDEN_CAMPOS = [
  'notaFinal',
  'cualitativo',
  'estandar',
  'aportesBloque1',
  'aportesBloque2',
  'refuerzo',
  'notaProyecto',
  'notaExamen',
];

function formatearValorCampo(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) {
      return '—';
    }
    return valor
      .map((item) =>
        item === null || item === undefined ? '—' : String(item),
      )
      .join(', ');
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  const texto = String(valor).trim();
  return texto || '—';
}

export function extraerDiferenciasNota(
  valorAnterior: Record<string, unknown> | null,
  valorNuevo: Record<string, unknown> | null,
): DiferenciaCampoNota[] {
  const conjunto = new Set<string>();
  if (valorAnterior) {
    for (const k of Object.keys(valorAnterior)) {
      conjunto.add(k);
    }
  }
  if (valorNuevo) {
    for (const k of Object.keys(valorNuevo)) {
      conjunto.add(k);
    }
  }

  const clavesOrdenadas = Array.from(conjunto).sort((a, b) => {
    const idxA = ORDEN_CAMPOS.indexOf(a);
    const idxB = ORDEN_CAMPOS.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const diferencias: DiferenciaCampoNota[] = [];
  for (const campo of clavesOrdenadas) {
    const anterior = formatearValorCampo(valorAnterior?.[campo]);
    const nuevo = formatearValorCampo(valorNuevo?.[campo]);
    if (anterior !== nuevo) {
      diferencias.push({
        campo,
        etiqueta: ETIQUETAS_CAMPOS[campo] ?? campo,
        anterior,
        nuevo,
      });
    }
  }
  return diferencias;
}

function etiquetaAccion(accion: AccionAuditoria): {
  texto: string;
  claseBadge: string;
} {
  switch (accion) {
    case 'CREATE':
      return {
        texto: 'Registro inicial',
        claseBadge: 'bg-sky-100 text-sky-800 border-sky-200',
      };
    case 'UPDATE':
      return {
        texto: 'Actualización',
        claseBadge: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'DELETE_LOGICAL':
      return {
        texto: 'Baja lógica',
        claseBadge: 'bg-rose-100 text-rose-800 border-rose-200',
      };
  }
}

function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }
  return fecha.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function crearEventosDemoHistorial(
  entidadId: string,
): RegistroAuditoriaAcademica[] {
  return [
    {
      id: `aud-demo-1-${entidadId}`,
      entidad: 'CALIFICACION',
      entidadId,
      accion: 'CREATE',
      valorAnterior: null,
      valorNuevo: {
        notaFinal: 8.5,
        cualitativo: 'B+',
        notaExamen: 8.0,
      },
      usuarioId: 'docente.demo',
      nombreUsuario: 'Carlos Docente',
      ocurridoEn: '2026-11-18T14:20:00Z',
    },
    {
      id: `aud-demo-2-${entidadId}`,
      entidad: 'CALIFICACION',
      entidadId,
      accion: 'UPDATE',
      valorAnterior: {
        notaFinal: 8.5,
        cualitativo: 'B+',
        notaExamen: 8.0,
      },
      valorNuevo: {
        notaFinal: 9.0,
        cualitativo: 'A-',
        notaExamen: 9.0,
      },
      usuarioId: 'docente.demo',
      nombreUsuario: 'Carlos Docente',
      ocurridoEn: '2026-11-20T09:45:00Z',
    },
  ];
}

export function ModalHistorialNota({
  entidadId,
  nombreEstudiante,
  nombreMateria,
  trimestre,
  eventosIniciales,
  omitirCargaRemota = false,
  alCerrar,
}: Readonly<PropiedadesModalHistorialNota>) {
  const [eventos, setEventos] = useState<RegistroAuditoriaAcademica[]>(() =>
    eventosIniciales && eventosIniciales.length > 0
      ? [...eventosIniciales]
      : crearEventosDemoHistorial(entidadId),
  );
  const [filtroAccion, setFiltroAccion] = useState<'TODAS' | AccionAuditoria>(
    'TODAS',
  );
  const [cargando, setCargando] = useState<boolean>(false);

  const cargarHistorial = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    setCargando(true);
    try {
      const remotos = await servicioAuditoriaNotasApi
        .listarHistorialNota(entidadId)
        .catch(() => []);
      if (remotos.length > 0) {
        setEventos(remotos);
      }
    } finally {
      setCargando(false);
    }
  }, [entidadId, omitirCargaRemota]);

  useEffect(() => {
    if (eventosIniciales && eventosIniciales.length > 0) {
      setEventos([...eventosIniciales]);
    } else {
      setEventos(crearEventosDemoHistorial(entidadId));
    }
  }, [entidadId, eventosIniciales]);

  useEffect(() => {
    cargarHistorial().catch(() => undefined);
  }, [cargarHistorial]);

  const eventosFiltrados = useMemo(() => {
    return [...eventos]
      .filter((ev) => filtroAccion === 'TODAS' || ev.accion === filtroAccion)
      .sort((a, b) => b.ocurridoEn.localeCompare(a.ocurridoEn));
  }, [eventos, filtroAccion]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-historial-nota"
      data-testid="modal-historial-nota"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Registro inalterable · RNF-09
            </span>
            <h3
              id="titulo-modal-historial-nota"
              className="text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <History className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Historial de cambios · {nombreEstudiante}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {nombreMateria} · Trimestre {trimestre}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar historial de cambios"
            onClick={alCerrar}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Filtros y recarga */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="filtro-accion-historial"
              className="text-xs font-semibold text-slate-700"
            >
              Acción:
            </label>
            <select
              id="filtro-accion-historial"
              data-testid="filtro-accion-historial"
              value={filtroAccion}
              onChange={(e) =>
                setFiltroAccion(e.target.value as 'TODAS' | AccionAuditoria)
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="TODAS">Todas las acciones</option>
              <option value="CREATE">Registro inicial</option>
              <option value="UPDATE">Actualizaciones</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              cargarHistorial().catch(() => undefined);
            }}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Actualizar
          </button>
        </div>

        {/* Línea de tiempo */}
        {eventosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            No existen eventos de auditoría para el filtro seleccionado.
          </div>
        ) : (
          <ol data-testid="lista-eventos-historial" className="space-y-3">
            {eventosFiltrados.map((evento) => {
              const infoAccion = etiquetaAccion(evento.accion);
              const diferencias = extraerDiferenciasNota(
                evento.valorAnterior,
                evento.valorNuevo,
              );

              return (
                <li
                  key={evento.id}
                  data-testid={`evento-historial-${evento.id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${infoAccion.claseBadge}`}
                    >
                      {infoAccion.texto}
                    </span>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <User className="w-3.5 h-3.5" aria-hidden="true" />
                        {evento.nombreUsuario || evento.usuarioId}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatearFechaHora(evento.ocurridoEn)}
                      </span>
                    </div>
                  </div>

                  {diferencias.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Sin cambios de valores registrados en este evento.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {diferencias.map((dif) => (
                        <div
                          key={dif.campo}
                          className="rounded-xl bg-white border border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-semibold text-slate-700">
                            {dif.etiqueta}
                          </span>
                          <span className="inline-flex items-center gap-2 font-mono">
                            <span className="text-slate-500 line-through">
                              {dif.anterior}
                            </span>
                            <ArrowRight
                              className="w-3.5 h-3.5 text-indigo-600"
                              aria-hidden="true"
                            />
                            <strong className="text-indigo-900">
                              {dif.nuevo}
                            </strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={alCerrar}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            Cerrar historial
          </button>
        </div>
      </div>
    </div>
  );
}
