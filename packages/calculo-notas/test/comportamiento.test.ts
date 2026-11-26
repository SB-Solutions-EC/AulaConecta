import { describe, expect, it } from 'vitest';
import hoja from '../casos/comportamiento-hoja-oficial.json';
import {
  CLAVES_INDICADORES_COMPORTAMIENTO,
  PUNTAJE_POR_ESCALA,
  TRAMOS_CUALITATIVOS_COMPORTAMIENTO,
  calcularComportamiento,
  type EscalaComportamiento,
  type IndicadoresComportamiento,
  type ResultadoCalculoComportamiento,
} from '../src/index';

// Indicador I-05 de comportamiento (T1124-A): el cálculo debe coincidir al 100 % con la hoja oficial.
// Cada fila de la hoja anonimizada (casos/comportamiento-hoja-oficial.json) es un caso: los valores esperados
// los calcula casos/generar_casos_comportamiento.py con aritmética exacta, sin compartir código con src/.

interface Caso {
  id: string;
  grupo: string;
  descripcion: string;
  indicadores: IndicadoresComportamiento;
  esperado: ResultadoCalculoComportamiento;
}

interface Curso {
  curso: string;
  casos: string[];
  esperado: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
}

const casos = hoja.casos as Caso[];
const cursos = hoja.cursos as Curso[];
const ESCALAS = Object.keys(PUNTAJE_POR_ESCALA) as EscalaComportamiento[];

describe('Hoja oficial de comportamiento anonimizada: I-05', () => {
  it('trae todos los casos que declara', () => {
    expect(casos).toHaveLength(hoja.totalCasos);
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
  });

  it('los 120 estudiantes generados y los casos límite cubren los cinco cualitativos', () => {
    expect(new Set(casos.map((c) => c.esperado.cualitativo))).toEqual(new Set(['A', 'B', 'C', 'D', 'E', null]));
  });

  describe.each([...new Set(casos.map((c) => c.grupo))])('%s', (grupo) => {
    it.each(casos.filter((c) => c.grupo === grupo))('$id · $descripcion', ({ indicadores, esperado }) => {
      const resultado = calcularComportamiento(indicadores);

      expect(resultado.completados, 'completados').toBe(esperado.completados);
      expect(resultado.total, 'total').toBe(esperado.total);
      expect(resultado.completo, 'completo').toBe(esperado.completo);
      expect(resultado.nota, 'nota').toBe(esperado.nota);
      expect(resultado.cualitativo, 'cualitativo').toBe(esperado.cualitativo);
      expect(resultado.etiqueta, 'etiqueta').toBe(esperado.etiqueta);
      expect(resultado.descripcion, 'descripcion').toBe(esperado.descripcion);
    });
  });

  // Hoja de comportamiento por curso: cuántos estudiantes tiene cada cualitativo
  it.each(cursos)('resumen de $curso por cualitativo', ({ casos: ids, esperado }) => {
    const resultados = casos.filter((c) => ids.includes(c.id)).map((c) => calcularComportamiento(c.indicadores));
    const conteo = Object.fromEntries(
      (['A', 'B', 'C', 'D', 'E'] as const).map((letra) => [letra, resultados.filter((r) => r.cualitativo === letra).length]),
    );

    expect(conteo).toEqual(esperado);
    expect(resultados.every((r) => r.completo)).toBe(true);
  });
});

describe('Comportamiento: propiedades del cálculo', () => {
  it('son nueve indicadores: cuatro cognitivos y cinco sociales', () => {
    expect(CLAVES_INDICADORES_COMPORTAMIENTO).toHaveLength(9);
    expect(CLAVES_INDICADORES_COMPORTAMIENTO.filter((c) => c.startsWith('cog'))).toHaveLength(4);
    expect(CLAVES_INDICADORES_COMPORTAMIENTO.filter((c) => c.startsWith('soc'))).toHaveLength(5);
  });

  it('puntajes de la escala y tramos del cualitativo de la hoja', () => {
    expect(PUNTAJE_POR_ESCALA).toEqual({ SIEMPRE: 10, FRECUENTEMENTE: 8, OCASIONALMENTE: 6, NUNCA: 2 });
    expect(TRAMOS_CUALITATIVOS_COMPORTAMIENTO.map((t) => [t.cualitativo, t.min])).toEqual([
      ['A', 9],
      ['B', 7.5],
      ['C', 6],
      ['D', 4],
      ['E', 0],
    ]);
  });

  it('el orden en que se marcan los indicadores no cambia el resultado', () => {
    for (const { indicadores } of casos) {
      const invertido = Object.fromEntries(
        CLAVES_INDICADORES_COMPORTAMIENTO.map((clave, i) => [
          clave,
          indicadores[CLAVES_INDICADORES_COMPORTAMIENTO[CLAVES_INDICADORES_COMPORTAMIENTO.length - 1 - i]],
        ]).filter(([, escala]) => escala !== undefined),
      ) as IndicadoresComportamiento;

      expect(calcularComportamiento(invertido)).toEqual(calcularComportamiento(indicadores));
    }
  });

  // La nota solo depende de cuántos indicadores hay en cada escala (y cuántos faltan): 715 combinaciones.
  // Se comprueban TODAS con aritmética de enteros (centésimas), sin coma flotante en el valor esperado.
  it('coincide con la aritmética exacta en las 715 combinaciones posibles de escalas', () => {
    const total = CLAVES_INDICADORES_COMPORTAMIENTO.length;
    let combinaciones = 0;

    for (let s = 0; s <= total; s++) {
      for (let f = 0; s + f <= total; f++) {
        for (let o = 0; s + f + o <= total; o++) {
          for (let n = 0; s + f + o + n <= total; n++) {
            const vacios = total - s - f - o - n;
            const escalas: (EscalaComportamiento | undefined)[] = [
              ...Array<EscalaComportamiento>(s).fill('SIEMPRE'),
              ...Array<EscalaComportamiento>(f).fill('FRECUENTEMENTE'),
              ...Array<EscalaComportamiento>(o).fill('OCASIONALMENTE'),
              ...Array<EscalaComportamiento>(n).fill('NUNCA'),
              ...Array<undefined>(vacios).fill(undefined),
            ];
            const indicadores: IndicadoresComportamiento = {};
            escalas.forEach((escala, i) => {
              if (escala) indicadores[CLAVES_INDICADORES_COMPORTAMIENTO[i]] = escala;
            });
            combinaciones += 1;

            const marcados = s + f + o + n;
            const resultado = calcularComportamiento(indicadores);
            expect(resultado.completados).toBe(marcados);
            if (marcados === 0) {
              expect(resultado.nota).toBeNull();
              expect(resultado.cualitativo).toBeNull();
              continue;
            }
            const suma = 10 * s + 8 * f + 6 * o + 2 * n;
            const centesimas = Math.floor((100 * suma) / marcados);
            const cualitativo = centesimas >= 900 ? 'A' : centesimas >= 750 ? 'B' : centesimas >= 600 ? 'C' : centesimas >= 400 ? 'D' : 'E';
            expect({ suma, nota: resultado.nota, cualitativo: resultado.cualitativo }).toEqual({ suma, nota: centesimas / 100, cualitativo });
          }
        }
      }
    }

    expect(combinaciones).toBe(715);
    expect(ESCALAS).toHaveLength(4);
  });
});
