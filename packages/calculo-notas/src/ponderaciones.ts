// Ponderaciones de la nota final (RN-02, RNF-10): el Administrador las cambia sin tocar código y las notas del
// trimestre abierto se recalculan. Son porcentajes: la regla oficial del colegio es 70 / 15 / 15.

export interface PonderacionesCalificacion {
  /** Porcentaje del promedio de aportes (con refuerzo si lo hay). */
  aportes: number;
  /** Porcentaje de la nota del proyecto. */
  proyecto: number;
  /** Porcentaje de la nota del examen. */
  examen: number;
}

export const PONDERACIONES_OFICIALES: Readonly<PonderacionesCalificacion> = { aportes: 70, proyecto: 15, examen: 15 };

const CAMPOS = ['aportes', 'proyecto', 'examen'] as const;

/**
 * Errores de un conjunto de ponderaciones (lista vacía si son válidas): cada porcentaje es un número de 0 a 100
 * con hasta 2 decimales y los tres suman exactamente 100 %. La suma se hace en centésimas, porque en coma
 * flotante hay combinaciones que no dan 100 exacto (por ejemplo `18.08 + 0.07 + 81.85` da 99,99999999999999).
 */
export function validarPonderaciones(valor: Readonly<Record<string, unknown>>): string[] {
  const errores: string[] = [];
  let centesimas = 0;
  for (const campo of CAMPOS) {
    const porcentaje = valor[campo];
    if (typeof porcentaje !== 'number' || !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      errores.push(`${campo} debe ser un porcentaje de 0 a 100`);
    } else if (Math.abs(porcentaje * 100 - Math.round(porcentaje * 100)) > 1e-6) {
      errores.push(`${campo} admite hasta 2 decimales`);
    } else {
      centesimas += Math.round(porcentaje * 100);
    }
  }
  if (errores.length === 0 && centesimas !== 10000) {
    errores.push('las ponderaciones deben sumar 100 %');
  }
  return errores;
}
