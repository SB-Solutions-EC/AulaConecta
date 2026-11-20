export type EstandarLogro = 'DA' | 'AA' | 'PA' | 'NA';

export interface DefinicionCampoAporte {
  clave: string;
  etiqueta: string;
}

export const CAMPOS_BLOQUE_1: ReadonlyArray<DefinicionCampoAporte> = [
  { clave: 'deberes', etiqueta: 'Deberes' },
  { clave: 'leccionesOrales', etiqueta: 'Lecciones orales' },
  { clave: 'pruebasEscritas', etiqueta: 'Pruebas escritas' },
  { clave: 'tareasClase', etiqueta: 'Tareas en clase' },
  { clave: 'exposiciones1', etiqueta: 'Exposiciones B1' },
];

export const CAMPOS_BLOQUE_2: ReadonlyArray<DefinicionCampoAporte> = [
  { clave: 'trabajosClase', etiqueta: 'Trabajos en clase' },
  { clave: 'lecciones2', etiqueta: 'Lecciones' },
  { clave: 'pruebas2', etiqueta: 'Pruebas' },
  { clave: 'demostraciones', etiqueta: 'Demostraciones' },
  { clave: 'exposiciones2', etiqueta: 'Exposiciones B2' },
];

export const ESCALA_CUALITATIVA: ReadonlyArray<{ min: number; etiqueta: string }> = [
  { min: 10, etiqueta: 'A+' },
  { min: 9, etiqueta: 'A-' },
  { min: 8, etiqueta: 'B+' },
  { min: 7, etiqueta: 'B-' },
  { min: 6, etiqueta: 'C+' },
  { min: 5, etiqueta: 'C-' },
  { min: 4, etiqueta: 'D+' },
  { min: 3, etiqueta: 'D-' },
  { min: 2, etiqueta: 'E+' },
  { min: 0, etiqueta: 'E-' },
];

export interface EntradaCalculoNota {
  aportesBloque1: ReadonlyArray<number | null | undefined>;
  aportesBloque2: ReadonlyArray<number | null | undefined>;
  refuerzo?: number | null;
  notaProyecto?: number | null;
  notaExamen?: number | null;
}

export interface ResultadoCalculoNota {
  promedioBloque1: number | null;
  promedioBloque2: number | null;
  promedioGeneral: number | null;
  promedioConRefuerzo: number | null;
  componente70: number | null;
  componenteProyecto15: number | null;
  componenteExamen15: number | null;
  notaFinal: number | null;
  cualitativo: string | null;
  estandar: EstandarLogro | null;
  requiereRefuerzo: boolean;
  alertaPromedioBajo: boolean;
}

export interface ResumenEstandaresCurso {
  totalEstudiantes: number;
  calificados: number;
  requierenRefuerzo: number;
  promedioCurso: number | null;
  conteo: Record<EstandarLogro, number>;
}

/**
 * Replica TRUNC(n, 2) de Excel con compensación mínima IEEE-754 para que valores
 * exactos en centésimas (ej. 8.2 * 0.7 = 5.74) no se recorten a 5.73.
 */
export function truncarADosDecimales(valor: number): number {
  const epsilon = valor >= 0 ? 1e-9 : -1e-9;
  return Math.trunc(valor * 100 + epsilon) / 100;
}

export function normalizarNotaEntrada(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.');
  if (!limpio) {
    return null;
  }
  const numero = Number(limpio);
  if (Number.isNaN(numero) || numero < 0 || numero > 10) {
    return null;
  }
  return numero;
}

export function promediarValores(
  valores: ReadonlyArray<number | null | undefined>,
): number | null {
  const validos = valores.filter(
    (valor): valor is number =>
      typeof valor === 'number' && Number.isFinite(valor),
  );
  if (validos.length === 0) {
    return null;
  }
  const suma = validos.reduce((acum, actual) => acum + actual, 0);
  return suma / validos.length;
}

export function obtenerCualitativo(notaFinal: number | null): string | null {
  if (notaFinal === null || !Number.isFinite(notaFinal)) {
    return null;
  }
  for (const tramo of ESCALA_CUALITATIVA) {
    if (notaFinal >= tramo.min) {
      return tramo.etiqueta;
    }
  }
  return 'E-';
}

export function obtenerEstandarDesdeCualitativo(
  cualitativo: string | null,
): EstandarLogro | null {
  if (!cualitativo) {
    return null;
  }
  if (cualitativo === 'A+' || cualitativo === 'A-') {
    return 'DA';
  }
  if (cualitativo === 'B+' || cualitativo === 'B-') {
    return 'AA';
  }
  if (cualitativo === 'C+' || cualitativo === 'C-') {
    return 'PA';
  }
  return 'NA';
}

export function calcularCalificacionInmediata(
  entrada: Readonly<EntradaCalculoNota>,
): ResultadoCalculoNota {
  const promedioBloque1 = promediarValores(entrada.aportesBloque1);
  const promedioBloque2 = promediarValores(entrada.aportesBloque2);
  const promedioGeneral = promediarValores([promedioBloque1, promedioBloque2]);

  const tieneRefuerzo =
    typeof entrada.refuerzo === 'number' && Number.isFinite(entrada.refuerzo);
  const promedioConRefuerzo = tieneRefuerzo
    ? promediarValores([promedioGeneral, entrada.refuerzo])
    : promedioGeneral;

  const componente70 =
    promedioConRefuerzo !== null
      ? truncarADosDecimales(promedioConRefuerzo * 0.7)
      : null;

  const componenteProyecto15 =
    typeof entrada.notaProyecto === 'number' &&
    Number.isFinite(entrada.notaProyecto)
      ? truncarADosDecimales(entrada.notaProyecto * 0.15)
      : null;

  const componenteExamen15 =
    typeof entrada.notaExamen === 'number' &&
    Number.isFinite(entrada.notaExamen)
      ? truncarADosDecimales(entrada.notaExamen * 0.15)
      : null;

  const notaFinal =
    componente70 !== null &&
    componenteProyecto15 !== null &&
    componenteExamen15 !== null
      ? truncarADosDecimales(
          componente70 + componenteProyecto15 + componenteExamen15,
        )
      : null;

  const cualitativo = obtenerCualitativo(notaFinal);
  const estandar = obtenerEstandarDesdeCualitativo(cualitativo);

  return {
    promedioBloque1,
    promedioBloque2,
    promedioGeneral,
    promedioConRefuerzo,
    componente70,
    componenteProyecto15,
    componenteExamen15,
    notaFinal,
    cualitativo,
    estandar,
    requiereRefuerzo: promedioGeneral !== null && promedioGeneral < 7,
    alertaPromedioBajo: notaFinal !== null && notaFinal < 7,
  };
}

export function calcularResumenEstandares(
  resultados: ReadonlyArray<ResultadoCalculoNota>,
): ResumenEstandaresCurso {
  const conteo: Record<EstandarLogro, number> = {
    DA: 0,
    AA: 0,
    PA: 0,
    NA: 0,
  };

  let calificados = 0;
  let requierenRefuerzo = 0;
  let sumaFinales = 0;

  for (const res of resultados) {
    if (res.requiereRefuerzo) {
      requierenRefuerzo += 1;
    }
    if (res.notaFinal !== null && res.estandar !== null) {
      calificados += 1;
      sumaFinales += res.notaFinal;
      conteo[res.estandar] += 1;
    }
  }

  return {
    totalEstudiantes: resultados.length,
    calificados,
    requierenRefuerzo,
    promedioCurso:
      calificados > 0 ? truncarADosDecimales(sumaFinales / calificados) : null,
    conteo,
  };
}
