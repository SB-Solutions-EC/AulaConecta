import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  CAMPOS_BLOQUE_1,
  CAMPOS_BLOQUE_2,
  calcularCalificacionInmediata,
  calcularResumenEstandares,
  normalizarNotaEntrada,
  type EstandarLogro,
} from '../calculo/calculoNotas';

export interface FilaEstudianteNotas {
  id: string;
  nombreEstudiante: string;
  bloque1: string[];
  bloque2: string[];
  refuerzo: string;
  proyecto: string;
  examen: string;
}

export interface PropiedadesPantallaCalculoNotas {
  filasIniciales?: ReadonlyArray<FilaEstudianteNotas>;
}

const FILAS_DEMO_INICIALES: ReadonlyArray<FilaEstudianteNotas> = [
  {
    id: 'est-1',
    nombreEstudiante: 'Simulada Ana',
    bloque1: ['9.0', '8.5', '9.0', '8.5', '9.0'],
    bloque2: ['9.0', '9.0', '8.5', '9.0', '9.5'],
    refuerzo: '',
    proyecto: '9.5',
    examen: '9.0',
  },
  {
    id: 'est-2',
    nombreEstudiante: 'Simulada Bruno',
    bloque1: ['6.0', '6.5', '5.5', '6.0', '6.0'],
    bloque2: ['6.0', '6.0', '6.5', '5.5', '6.0'],
    refuerzo: '8.0',
    proyecto: '7.5',
    examen: '7.0',
  },
  {
    id: 'est-3',
    nombreEstudiante: 'Inventado Camila',
    bloque1: ['5.5', '6.0', '5.0', '6.0', '5.5'],
    bloque2: ['6.0', '5.5', '6.0', '5.5', '6.0'],
    refuerzo: '',
    proyecto: '6.0',
    examen: '6.0',
  },
];

function clonarFilas(
  filas: ReadonlyArray<FilaEstudianteNotas>,
): FilaEstudianteNotas[] {
  return filas.map((fila) => ({
    ...fila,
    bloque1: [...fila.bloque1],
    bloque2: [...fila.bloque2],
  }));
}

function crearFilaVacia(indice: number): FilaEstudianteNotas {
  return {
    id: `est-nuevo-${indice}`,
    nombreEstudiante: `Estudiante Demo ${indice}`,
    bloque1: ['', '', '', '', ''],
    bloque2: ['', '', '', '', ''],
    refuerzo: '',
    proyecto: '',
    examen: '',
  };
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

const ETIQUETAS_ESTANDAR: Record<EstandarLogro, string> = {
  DA: 'Domina (DA)',
  AA: 'Alcanza (AA)',
  PA: 'Próximo (PA)',
  NA: 'No alcanza (NA)',
};

export function PantallaCalculoNotas({
  filasIniciales = FILAS_DEMO_INICIALES,
}: Readonly<PropiedadesPantallaCalculoNotas>) {
  const [trimestre, setTrimestre] = useState<number>(1);
  const [filas, setFilas] = useState<FilaEstudianteNotas[]>(() =>
    clonarFilas(filasIniciales),
  );
  const [nombreNuevo, setNombreNuevo] = useState<string>('');

  const calculosPorFila = useMemo(
    () =>
      filas.map((fila) =>
        calcularCalificacionInmediata({
          aportesBloque1: fila.bloque1.map(normalizarNotaEntrada),
          aportesBloque2: fila.bloque2.map(normalizarNotaEntrada),
          refuerzo: normalizarNotaEntrada(fila.refuerzo),
          notaProyecto: normalizarNotaEntrada(fila.proyecto),
          notaExamen: normalizarNotaEntrada(fila.examen),
        }),
      ),
    [filas],
  );

  const resumenCurso = useMemo(
    () => calcularResumenEstandares(calculosPorFila),
    [calculosPorFila],
  );

  const actualizarAporte = (
    indiceFila: number,
    bloque: 'bloque1' | 'bloque2',
    indiceCampo: number,
    valor: string,
  ) => {
    setFilas((previas) =>
      previas.map((fila, idx) => {
        if (idx !== indiceFila) {
          return fila;
        }
        const copiaBloque = [...fila[bloque]];
        copiaBloque[indiceCampo] = valor;
        return { ...fila, [bloque]: copiaBloque };
      }),
    );
  };

  const actualizarCampoSimple = (
    indiceFila: number,
    campo: 'refuerzo' | 'proyecto' | 'examen',
    valor: string,
  ) => {
    setFilas((previas) =>
      previas.map((fila, idx) =>
        idx === indiceFila ? { ...fila, [campo]: valor } : fila,
      ),
    );
  };

  const agregarFilaEstudiante = () => {
    const nombreLimpio = nombreNuevo.trim();
    const nueva = crearFilaVacia(filas.length + 1);
    if (nombreLimpio) {
      nueva.nombreEstudiante = nombreLimpio;
    }
    setFilas((previas) => [...previas, nueva]);
    setNombreNuevo('');
  };

  const restablecerEjemplo = () => {
    setFilas(clonarFilas(filasIniciales));
  };

  return (
    <section
      data-testid="pantalla-calculo-notas"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Cálculo oficial inmediato · T1117-C · RF-17, RF-18, RNF-02
          </span>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" aria-hidden="true" />
            Libreta de Calificaciones con Cálculo Inmediato
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Calcula al instante 70 % bloques con refuerzo académico opcional, 15 % proyecto y 15 % examen, truncado a 2 decimales y escala cualitativa A+ a E-.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="selector-trimestre-calculo"
            className="text-xs font-semibold text-slate-700"
          >
            Trimestre:
          </label>
          <select
            id="selector-trimestre-calculo"
            value={trimestre}
            onChange={(e) => setTrimestre(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            <option value={1}>Trimestre 1</option>
            <option value={2}>Trimestre 2</option>
            <option value={3}>Trimestre 3</option>
          </select>

          <button
            type="button"
            onClick={restablecerEjemplo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restablecer
          </button>
        </div>
      </header>

      <div
        data-testid="resumen-calculo-curso"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs text-slate-500">Trimestre {trimestre} · Calificados</p>
          <p className="text-xl font-bold text-slate-900">
            {resumenCurso.calificados} / {resumenCurso.totalEstudiantes}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5">
          <p className="text-xs text-indigo-700">Promedio general</p>
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

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          aria-label="Nombre de nuevo estudiante"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre completo del estudiante..."
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={agregarFilaEstudiante}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Agregar fila de cálculo
        </button>
      </div>

      <div className="space-y-4" data-testid="lista-libreta-calculo">
        {filas.map((fila, indiceFila) => {
          const calculo = calculosPorFila[indiceFila];
          return (
            <article
              key={fila.id}
              data-testid={`fila-nota-${fila.id}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {fila.nombreEstudiante}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prom. B1: <strong>{formatearDecimal(calculo.promedioBloque1)}</strong> · Prom. B2:{' '}
                    <strong>{formatearDecimal(calculo.promedioBloque2)}</strong> · Prom. General:{' '}
                    <strong>{formatearDecimal(calculo.promedioGeneral)}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {calculo.requiereRefuerzo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Requiere refuerzo
                    </span>
                  ) : null}

                  {calculo.alertaPromedioBajo ? (
                    <span
                      data-testid={`alerta-promedio-bajo-${fila.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Promedio &lt; 7,00 (RF-30)
                    </span>
                  ) : null}

                  {calculo.notaFinal !== null && !calculo.alertaPromedioBajo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Aprobado
                    </span>
                  ) : null}

                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Nota final:</span>
                    <strong
                      data-testid={`nota-final-${fila.id}`}
                      className="text-base font-bold text-slate-900"
                    >
                      {formatearDecimal(calculo.notaFinal)}
                    </strong>
                    <span
                      data-testid={`cualitativo-${fila.id}`}
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${claseBadgeCualitativo(calculo.cualitativo)}`}
                    >
                      {calculo.cualitativo ?? '—'}
                    </span>
                    {calculo.estandar ? (
                      <span className="text-[11px] font-semibold text-slate-600">
                        {ETIQUETAS_ESTANDAR[calculo.estandar]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Bloque 1 (5 aportes)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-2 gap-2">
                    {CAMPOS_BLOQUE_1.map((campo, idxCampo) => (
                      <label
                        key={campo.clave}
                        className="block text-[11px] font-medium text-slate-600"
                      >
                        {campo.etiqueta}
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step="0.01"
                          aria-label={`${fila.nombreEstudiante} - ${campo.etiqueta}`}
                          value={fila.bloque1[idxCampo] ?? ''}
                          onChange={(e) =>
                            actualizarAporte(
                              indiceFila,
                              'bloque1',
                              idxCampo,
                              e.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Bloque 2 (5 aportes)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-2 gap-2">
                    {CAMPOS_BLOQUE_2.map((campo, idxCampo) => (
                      <label
                        key={campo.clave}
                        className="block text-[11px] font-medium text-slate-600"
                      >
                        {campo.etiqueta}
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step="0.01"
                          aria-label={`${fila.nombreEstudiante} - ${campo.etiqueta}`}
                          value={fila.bloque2[idxCampo] ?? ''}
                          onChange={(e) =>
                            actualizarAporte(
                              indiceFila,
                              'bloque2',
                              idxCampo,
                              e.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Ponderación oficial (70 % / 15 % / 15 %)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Refuerzo
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step="0.01"
                        aria-label={`${fila.nombreEstudiante} - Refuerzo`}
                        value={fila.refuerzo}
                        onChange={(e) =>
                          actualizarCampoSimple(
                            indiceFila,
                            'refuerzo',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Proyecto
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step="0.01"
                        aria-label={`${fila.nombreEstudiante} - Proyecto`}
                        value={fila.proyecto}
                        onChange={(e) =>
                          actualizarCampoSimple(
                            indiceFila,
                            'proyecto',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Examen
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step="0.01"
                        aria-label={`${fila.nombreEstudiante} - Examen`}
                        value={fila.examen}
                        onChange={(e) =>
                          actualizarCampoSimple(
                            indiceFila,
                            'examen',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      70 % bloques: <strong>{formatearDecimal(calculo.componente70)}</strong>
                    </span>
                    <span>
                      15 % proyecto:{' '}
                      <strong>{formatearDecimal(calculo.componenteProyecto15)}</strong>
                    </span>
                    <span>
                      15 % examen:{' '}
                      <strong>{formatearDecimal(calculo.componenteExamen15)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
