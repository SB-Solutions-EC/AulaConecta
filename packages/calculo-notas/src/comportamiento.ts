// Cálculo del comportamiento (RF-22): nueve indicadores (cuatro cognitivos y cinco sociales) en la escala
// Siempre / Frecuentemente / Ocasionalmente / Nunca. La nota es el promedio de los puntajes, truncado a
// dos decimales, y de ella salen el cualitativo (A a E) y su descripción.
// Es el mismo código en la PWA (vista inmediata) y en ms-academico (cálculo oficial al guardar).

export type EscalaComportamiento = 'SIEMPRE' | 'FRECUENTEMENTE' | 'OCASIONALMENTE' | 'NUNCA';

export type ClaveIndicadorComportamiento =
  | 'cog1'
  | 'cog2'
  | 'cog3'
  | 'cog4'
  | 'soc1'
  | 'soc2'
  | 'soc3'
  | 'soc4'
  | 'soc5';

export type IndicadoresComportamiento = Partial<Record<ClaveIndicadorComportamiento, EscalaComportamiento>>;

export type CualitativoComportamiento = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TramoCualitativoComportamiento {
  min: number;
  cualitativo: CualitativoComportamiento;
  etiqueta: string;
  descripcion: string;
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

export const CLAVES_INDICADORES_COMPORTAMIENTO: ReadonlyArray<ClaveIndicadorComportamiento> = [
  'cog1',
  'cog2',
  'cog3',
  'cog4',
  'soc1',
  'soc2',
  'soc3',
  'soc4',
  'soc5',
];

export const PUNTAJE_POR_ESCALA: Readonly<Record<EscalaComportamiento, number>> = {
  SIEMPRE: 10,
  FRECUENTEMENTE: 8,
  OCASIONALMENTE: 6,
  NUNCA: 2,
};

/** De mayor a menor: el cualitativo es el del primer tramo cuyo mínimo alcanza la nota ya truncada. */
export const TRAMOS_CUALITATIVOS_COMPORTAMIENTO: ReadonlyArray<TramoCualitativoComportamiento> = [
  {
    min: 9.0,
    cualitativo: 'A',
    etiqueta: 'Muy satisfactorio',
    descripcion: 'Lidera el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 7.5,
    cualitativo: 'B',
    etiqueta: 'Satisfactorio',
    descripcion: 'Cumple con los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 6.0,
    cualitativo: 'C',
    etiqueta: 'Poco satisfactorio',
    descripcion: 'Falla ocasionalmente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 4.0,
    cualitativo: 'D',
    etiqueta: 'Mejorable',
    descripcion: 'Falla reiteradamente en el cumplimiento de los compromisos establecidos para la sana convivencia social.',
  },
  {
    min: 0,
    cualitativo: 'E',
    etiqueta: 'Insatisfactorio',
    descripcion: 'No cumple con los compromisos establecidos para la sana convivencia social.',
  },
];

/**
 * Nota, cualitativo y descripción de los indicadores marcados. Solo es una evaluación oficial cuando
 * `completo` es verdadero (los nueve indicadores): con menos es una vista previa y el servidor no la guarda.
 */
export function calcularComportamiento(indicadores: IndicadoresComportamiento): ResultadoCalculoComportamiento {
  let suma = 0;
  let completados = 0;

  for (const clave of CLAVES_INDICADORES_COMPORTAMIENTO) {
    const valor = indicadores[clave];
    if (valor) {
      suma += PUNTAJE_POR_ESCALA[valor];
      completados += 1;
    }
  }

  const total = CLAVES_INDICADORES_COMPORTAMIENTO.length;
  if (completados === 0) {
    return { completados: 0, total, completo: false, nota: null, cualitativo: null, etiqueta: null, descripcion: null };
  }

  const promedio = suma / completados;
  const nota = Math.trunc(promedio * 100 + 1e-9) / 100;
  // El último tramo empieza en 0 y la nota nunca es negativa: siempre hay un tramo
  const tramo = TRAMOS_CUALITATIVOS_COMPORTAMIENTO.find((t) => nota >= t.min) as TramoCualitativoComportamiento;

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
