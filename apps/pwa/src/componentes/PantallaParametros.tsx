import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  servicioParametrosApi,
  type ParametroColegio,
} from '../api/parametrosApi';
import { calcularCalificacionInmediata } from '@aulaconecta/calculo-notas';

export type PestanaParametros = 'PONDERACIONES' | 'ESCALAS' | 'TEXTOS';

export interface PonderacionesConfig {
  pctAportes: string;
  pctProyecto: string;
  pctExamen: string;
  minimoAprobacion: string;
}

export interface EscalaCualitativaConfig {
  codigo: 'DA' | 'AA' | 'PA' | 'NA';
  etiqueta: string;
  min: string;
}

export interface TextoComportamientoConfig {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  etiqueta: string;
  descripcion: string;
}

export interface PropiedadesPantallaParametros {
  parametrosIniciales?: ReadonlyArray<ParametroColegio>;
  omitirCargaRemota?: boolean;
}

export const CLAVE_PONDERACIONES = 'ponderaciones_calificaciones';
export const CLAVE_ESCALAS = 'escalas_cualitativas';
export const CLAVE_TEXTOS_COMPORTAMIENTO = 'textos_comportamiento';

const PONDERACIONES_DEFECTO: PonderacionesConfig = {
  pctAportes: '70',
  pctProyecto: '15',
  pctExamen: '15',
  minimoAprobacion: '7.00',
};

const ESCALAS_DEFECTO: ReadonlyArray<EscalaCualitativaConfig> = [
  { codigo: 'DA', etiqueta: 'Domina los aprendizajes', min: '9.00' },
  { codigo: 'AA', etiqueta: 'Alcanza los aprendizajes', min: '7.00' },
  { codigo: 'PA', etiqueta: 'Próximo a alcanzar', min: '4.01' },
  { codigo: 'NA', etiqueta: 'No alcanza los aprendizajes', min: '0.00' },
];

const TEXTOS_DEFECTO: ReadonlyArray<TextoComportamientoConfig> = [
  {
    letra: 'A',
    etiqueta: 'Muy satisfactorio',
    descripcion:
      'Lidera el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    letra: 'B',
    etiqueta: 'Satisfactorio',
    descripcion:
      'Cumple con los compromisos establecidos para la sana convivencia social.',
  },
  {
    letra: 'C',
    etiqueta: 'Poco satisfactorio',
    descripcion:
      'Falla ocasionalmente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    letra: 'D',
    etiqueta: 'Mejorable',
    descripcion:
      'Falla reiteradamente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    letra: 'E',
    etiqueta: 'Insatisfactorio',
    descripcion:
      'No cumple con los compromisos establecidos para la sana convivencia social.',
  },
];

export function simularNotaConPonderaciones(entrada: {
  aportes: number;
  proyecto: number;
  examen: number;
  pctAportes: number;
  pctProyecto: number;
  pctExamen: number;
}): number {
  // El mismo cálculo que el servidor (paquete compartido, RNF-10): cada componente se trunca a 2 decimales
  // antes de sumar, así que la vista previa coincide con la nota que se guardará.
  const resultado = calcularCalificacionInmediata(
    {
      aportesBloque1: [entrada.aportes],
      aportesBloque2: [entrada.aportes],
      refuerzo: null,
      notaProyecto: entrada.proyecto,
      notaExamen: entrada.examen,
    },
    {
      aportes: entrada.pctAportes,
      proyecto: entrada.pctProyecto,
      examen: entrada.pctExamen,
    },
  );
  return resultado.notaFinal as number;
}

function parsearNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) {
    return null;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function leerCadena(
  obj: Record<string, unknown>,
  clave: string,
  defecto: string,
): string {
  const v = obj[clave];
  if (typeof v === 'string' && v.trim()) {
    return v;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  return defecto;
}

export function PantallaParametros({
  parametrosIniciales = [],
  omitirCargaRemota = false,
}: Readonly<PropiedadesPantallaParametros>) {
  const [pestana, setPestana] = useState<PestanaParametros>('PONDERACIONES');

  const [ponderaciones, setPonderaciones] = useState<PonderacionesConfig>(
    () => ({ ...PONDERACIONES_DEFECTO }),
  );
  const [escalas, setEscalas] = useState<EscalaCualitativaConfig[]>(() =>
    ESCALAS_DEFECTO.map((e) => ({ ...e })),
  );
  const [textos, setTextos] = useState<TextoComportamientoConfig[]>(() =>
    TEXTOS_DEFECTO.map((t) => ({ ...t })),
  );

  const [versiones, setVersiones] = useState<Record<string, number>>({
    [CLAVE_PONDERACIONES]: 1,
    [CLAVE_ESCALAS]: 1,
    [CLAVE_TEXTOS_COMPORTAMIENTO]: 1,
  });

  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const aplicarListaParametros = useCallback(
    (lista: ReadonlyArray<ParametroColegio>) => {
      if (lista.length === 0) {
        return;
      }

      const nuevasVersiones: Record<string, number> = {};

      for (const param of lista) {
        nuevasVersiones[param.clave] = param.version;

        if (param.clave === CLAVE_PONDERACIONES) {
          setPonderaciones({
            pctAportes: leerCadena(
              param.valor,
              'aportes',
              PONDERACIONES_DEFECTO.pctAportes,
            ),
            pctProyecto: leerCadena(
              param.valor,
              'proyecto',
              PONDERACIONES_DEFECTO.pctProyecto,
            ),
            pctExamen: leerCadena(
              param.valor,
              'examen',
              PONDERACIONES_DEFECTO.pctExamen,
            ),
            minimoAprobacion: leerCadena(
              param.valor,
              'minimoAprobacion',
              PONDERACIONES_DEFECTO.minimoAprobacion,
            ),
          });
        } else if (
          param.clave === CLAVE_ESCALAS &&
          Array.isArray(param.valor.escalas)
        ) {
          const items = param.valor.escalas as Array<Record<string, unknown>>;
          setEscalas(
            ESCALAS_DEFECTO.map((def) => {
              const encontrado = items.find((i) => i.codigo === def.codigo);
              return encontrado
                ? {
                    codigo: def.codigo,
                    etiqueta: leerCadena(encontrado, 'etiqueta', def.etiqueta),
                    min: leerCadena(encontrado, 'min', def.min),
                  }
                : { ...def };
            }),
          );
        } else if (
          param.clave === CLAVE_TEXTOS_COMPORTAMIENTO &&
          Array.isArray(param.valor.niveles)
        ) {
          const items = param.valor.niveles as Array<Record<string, unknown>>;
          setTextos(
            TEXTOS_DEFECTO.map((def) => {
              const encontrado = items.find((i) => i.letra === def.letra);
              return encontrado
                ? {
                    letra: def.letra,
                    etiqueta: leerCadena(encontrado, 'etiqueta', def.etiqueta),
                    descripcion: leerCadena(
                      encontrado,
                      'descripcion',
                      def.descripcion,
                    ),
                  }
                : { ...def };
            }),
          );
        }
      }

      setVersiones((prev) => ({ ...prev, ...nuevasVersiones }));
    },
    [],
  );

  const cargarParametros = useCallback(async () => {
    if (omitirCargaRemota) {
      return;
    }
    setCargando(true);
    try {
      const remotos = await servicioParametrosApi
        .listarParametros()
        .catch(() => []);
      aplicarListaParametros(remotos);
    } finally {
      setCargando(false);
    }
  }, [aplicarListaParametros, omitirCargaRemota]);

  useEffect(() => {
    if (parametrosIniciales.length > 0) {
      aplicarListaParametros(parametrosIniciales);
    }
  }, [aplicarListaParametros, parametrosIniciales]);

  useEffect(() => {
    cargarParametros().catch(() => undefined);
  }, [cargarParametros]);

  const calculoPonderaciones = useMemo(() => {
    const ap = parsearNumero(ponderaciones.pctAportes);
    const pr = parsearNumero(ponderaciones.pctProyecto);
    const ex = parsearNumero(ponderaciones.pctExamen);
    const min = parsearNumero(ponderaciones.minimoAprobacion);
    const suma =
      ap !== null && pr !== null && ex !== null ? ap + pr + ex : null;
    const notaSimulada =
      ap !== null && pr !== null && ex !== null
        ? simularNotaConPonderaciones({
            aportes: 8.0,
            proyecto: 10.0,
            examen: 9.0,
            pctAportes: ap,
            pctProyecto: pr,
            pctExamen: ex,
          })
        : null;
    return { ap, pr, ex, min, suma, notaSimulada };
  }, [ponderaciones]);

  const persistirParametro = async (
    clave: string,
    valor: Record<string, unknown>,
    mensajeOk: string,
  ) => {
    const versionActual = versiones[clave] ?? 1;
    setGuardando(true);
    try {
      let nuevaVersion = versionActual + 1;
      if (!omitirCargaRemota) {
        try {
          const actualizado =
            await servicioParametrosApi.actualizarParametro({
              clave,
              valor,
              version: versionActual,
            });
          nuevaVersion = actualizado.version;
        } catch (error) {
          if (
            error instanceof ErrorHttpApi &&
            error.estado >= 400 &&
            error.estado < 500
          ) {
            setMensajeError(error.message);
            return;
          }
        }
      }
      setVersiones((prev) => ({ ...prev, [clave]: nuevaVersion }));
      setMensajeExito(mensajeOk);
    } finally {
      setGuardando(false);
    }
  };

  const manejarGuardarPonderaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const { ap, pr, ex, min, suma } = calculoPonderaciones;
    if (
      ap === null ||
      pr === null ||
      ex === null ||
      ap < 0 ||
      ap > 100 ||
      pr < 0 ||
      pr > 100 ||
      ex < 0 ||
      ex > 100
    ) {
      setMensajeError('Cada ponderación debe ser un porcentaje entre 0 y 100.');
      return;
    }
    if (suma === null || Math.abs(suma - 100) > 0.001) {
      setMensajeError(
        `Las ponderaciones deben sumar exactamente 100 % (suma actual: ${suma ?? 0} %).`,
      );
      return;
    }
    if (min === null || min < 1 || min > 10) {
      setMensajeError(
        'La nota mínima de aprobación debe estar entre 1.00 y 10.00.',
      );
      return;
    }

    await persistirParametro(
      CLAVE_PONDERACIONES,
      {
        aportes: ap,
        proyecto: pr,
        examen: ex,
        minimoAprobacion: min,
      },
      `Ponderaciones guardadas (${ap}% / ${pr}% / ${ex}%, mínimo ${min.toFixed(2)}).`,
    );
  };

  const manejarGuardarEscalas = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const valoresNumericos: number[] = [];
    for (const item of escalas) {
      if (!item.etiqueta.trim()) {
        setMensajeError(`Ingresa la etiqueta de la escala ${item.codigo}.`);
        return;
      }
      const n = parsearNumero(item.min);
      if (n === null || n < 0 || n > 10) {
        setMensajeError(
          `El puntaje mínimo de ${item.codigo} debe estar entre 0 y 10.`,
        );
        return;
      }
      valoresNumericos.push(n);
    }

    for (let i = 0; i < valoresNumericos.length - 1; i += 1) {
      if (valoresNumericos[i] <= valoresNumericos[i + 1]) {
        setMensajeError(
          'Los umbrales de DA, AA, PA y NA deben ir en orden estrictamente descendente.',
        );
        return;
      }
    }

    await persistirParametro(
      CLAVE_ESCALAS,
      {
        escalas: escalas.map((item, idx) => ({
          codigo: item.codigo,
          etiqueta: item.etiqueta.trim(),
          min: valoresNumericos[idx],
        })),
      },
      'Escalas cualitativas actualizadas correctamente.',
    );
  };

  const manejarGuardarTextos = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    for (const item of textos) {
      if (!item.etiqueta.trim() || !item.descripcion.trim()) {
        setMensajeError(
          `Completa la etiqueta y descripción del nivel ${item.letra}.`,
        );
        return;
      }
    }

    await persistirParametro(
      CLAVE_TEXTOS_COMPORTAMIENTO,
      {
        niveles: textos.map((item) => ({
          letra: item.letra,
          etiqueta: item.etiqueta.trim(),
          descripcion: item.descripcion.trim(),
        })),
      },
      'Textos de comportamiento actualizados correctamente.',
    );
  };

  const manejarRestaurarDefecto = () => {
    setMensajeError(null);
    setPonderaciones({ ...PONDERACIONES_DEFECTO });
    setEscalas(ESCALAS_DEFECTO.map((e) => ({ ...e })));
    setTextos(TEXTOS_DEFECTO.map((t) => ({ ...t })));
    setMensajeExito('Valores institucionales restaurados en el formulario.');
  };

  return (
    <section
      data-testid="pantalla-parametros"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Configuración institucional · RNF-10 · Administrador
          </span>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal
              className="w-6 h-6 text-indigo-600"
              aria-hidden="true"
            />
            Parámetros Configurables del Colegio
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Ajusta ponderaciones de calificación, escalas cualitativas y descripciones oficiales de comportamiento sin modificar el código del sistema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="boton-restaurar-parametros"
            onClick={manejarRestaurarDefecto}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restaurar valores
          </button>
          <button
            type="button"
            onClick={() => {
              cargarParametros().catch(() => undefined);
            }}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Recargar
          </button>
        </div>
      </header>

      {/* Pestañas */}
      <div role="tablist" className="flex flex-wrap gap-2">
        {(
          [
            {
              id: 'PONDERACIONES',
              testId: 'tab-ponderaciones',
              titulo: 'Ponderaciones de notas',
            },
            {
              id: 'ESCALAS',
              testId: 'tab-escalas',
              titulo: 'Escalas cualitativas',
            },
            {
              id: 'TEXTOS',
              testId: 'tab-textos',
              titulo: 'Textos de comportamiento',
            },
          ] as const
        ).map((tab) => {
          const activa = pestana === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activa}
              data-testid={tab.testId}
              onClick={() => {
                setPestana(tab.id);
                setMensajeError(null);
                setMensajeExito(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activa
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.titulo}
            </button>
          );
        })}
      </div>

      {mensajeExito && (
        <div
          data-testid="aviso-exito-parametros"
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2 font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          data-testid="aviso-error-parametros"
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center gap-2 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </div>
      )}

      {/* Pestaña 1: Ponderaciones */}
      {pestana === 'PONDERACIONES' && (
        <form onSubmit={manejarGuardarPonderaciones} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="input-ponderacion-aportes"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Bloques de aportes (%)
              </label>
              <input
                id="input-ponderacion-aportes"
                data-testid="input-ponderacion-aportes"
                type="text"
                inputMode="decimal"
                value={ponderaciones.pctAportes}
                onChange={(e) =>
                  setPonderaciones((p) => ({ ...p, pctAportes: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="input-ponderacion-proyecto"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Proyecto integrador (%)
              </label>
              <input
                id="input-ponderacion-proyecto"
                data-testid="input-ponderacion-proyecto"
                type="text"
                inputMode="decimal"
                value={ponderaciones.pctProyecto}
                onChange={(e) =>
                  setPonderaciones((p) => ({
                    ...p,
                    pctProyecto: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="input-ponderacion-examen"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Examen trimestral (%)
              </label>
              <input
                id="input-ponderacion-examen"
                data-testid="input-ponderacion-examen"
                type="text"
                inputMode="decimal"
                value={ponderaciones.pctExamen}
                onChange={(e) =>
                  setPonderaciones((p) => ({ ...p, pctExamen: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="input-minimo-aprobacion"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mínimo aprobación (0–10)
              </label>
              <input
                id="input-minimo-aprobacion"
                data-testid="input-minimo-aprobacion"
                type="text"
                inputMode="decimal"
                value={ponderaciones.minimoAprobacion}
                onChange={(e) =>
                  setPonderaciones((p) => ({
                    ...p,
                    minimoAprobacion: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              data-testid="resumen-suma-ponderaciones"
              className={`rounded-2xl border p-4 text-xs font-semibold ${
                calculoPonderaciones.suma !== null &&
                Math.abs(calculoPonderaciones.suma - 100) <= 0.001
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : 'border-rose-200 bg-rose-50/70 text-rose-900'
              }`}
            >
              Suma total de componentes:{' '}
              <strong>
                {calculoPonderaciones.suma !== null
                  ? `${calculoPonderaciones.suma} %`
                  : '—'}
              </strong>{' '}
              (requerido: 100 %)
            </div>

            <div
              data-testid="simulador-ponderaciones"
              className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Calculator className="w-4 h-4 text-sky-700" aria-hidden="true" />
                Simulación (Aportes 8.00 · Proyecto 10.00 · Examen 9.00):
              </span>
              <strong className="text-sm">
                {calculoPonderaciones.notaSimulada !== null
                  ? calculoPonderaciones.notaSimulada.toFixed(2)
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              data-testid="version-parametro-ponderaciones"
              className="text-xs text-slate-500"
            >
              Versión vigente: v{versiones[CLAVE_PONDERACIONES]}
            </span>
            <button
              type="submit"
              data-testid="boton-guardar-ponderaciones"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {guardando ? 'Guardando…' : 'Guardar ponderaciones'}
            </button>
          </div>
        </form>
      )}

      {/* Pestaña 2: Escalas cualitativas */}
      {pestana === 'ESCALAS' && (
        <form onSubmit={manejarGuardarEscalas} className="space-y-4">
          <div className="space-y-3">
            {escalas.map((item, idx) => (
              <div
                key={item.codigo}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"
              >
                <div className="sm:col-span-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    {item.codigo}
                  </span>
                </div>
                <div className="sm:col-span-7">
                  <label
                    htmlFor={`input-escala-etiqueta-${item.codigo}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Etiqueta institucional
                  </label>
                  <input
                    id={`input-escala-etiqueta-${item.codigo}`}
                    data-testid={`input-escala-etiqueta-${item.codigo}`}
                    type="text"
                    value={item.etiqueta}
                    onChange={(e) =>
                      setEscalas((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, etiqueta: e.target.value } : row,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor={`input-escala-min-${item.codigo}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Puntaje mínimo
                  </label>
                  <input
                    id={`input-escala-min-${item.codigo}`}
                    data-testid={`input-escala-min-${item.codigo}`}
                    type="text"
                    inputMode="decimal"
                    value={item.min}
                    onChange={(e) =>
                      setEscalas((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, min: e.target.value } : row,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="boton-guardar-escalas"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {guardando ? 'Guardando…' : 'Guardar escalas'}
            </button>
          </div>
        </form>
      )}

      {/* Pestaña 3: Textos de comportamiento */}
      {pestana === 'TEXTOS' && (
        <form onSubmit={manejarGuardarTextos} className="space-y-4">
          <div className="space-y-3">
            {textos.map((item, idx) => (
              <div
                key={item.letra}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"
              >
                <div className="sm:col-span-1 pt-1">
                  <span className="inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    {item.letra}
                  </span>
                </div>
                <div className="sm:col-span-4">
                  <label
                    htmlFor={`input-texto-etiqueta-${item.letra}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Etiqueta
                  </label>
                  <input
                    id={`input-texto-etiqueta-${item.letra}`}
                    data-testid={`input-texto-etiqueta-${item.letra}`}
                    type="text"
                    value={item.etiqueta}
                    onChange={(e) =>
                      setTextos((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, etiqueta: e.target.value } : row,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-7">
                  <label
                    htmlFor={`input-texto-descripcion-${item.letra}`}
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Descripción oficial
                  </label>
                  <textarea
                    id={`input-texto-descripcion-${item.letra}`}
                    data-testid={`input-texto-descripcion-${item.letra}`}
                    rows={2}
                    value={item.descripcion}
                    onChange={(e) =>
                      setTextos((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? { ...row, descripcion: e.target.value }
                            : row,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="boton-guardar-textos"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {guardando ? 'Guardando…' : 'Guardar textos'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
