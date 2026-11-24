import { describe, expect, it } from 'vitest';
import hoja from '../casos/hoja-oficial-anonimizada.json';
import {
  calcularCalificacionInmediata,
  calcularResumenEstandares,
  type EntradaCalculoNota,
  type ResultadoCalculoNota,
} from '../src/index';

// Indicador I-05 (T1117-A): el cálculo debe coincidir al 100 % con el libro de calificaciones oficial.
// Cada fila de la hoja anonimizada (casos/hoja-oficial-anonimizada.json) es un caso: los valores
// esperados los calcula casos/generar_casos.py con aritmética exacta, sin compartir código con src/.

interface Caso {
  id: string;
  grupo: string;
  descripcion: string;
  entrada: EntradaCalculoNota;
  esperado: ResultadoCalculoNota;
}

interface Curso {
  curso: string;
  casos: string[];
  esperado: Pick<ReturnType<typeof calcularResumenEstandares>, 'totalEstudiantes' | 'calificados' | 'requierenRefuerzo' | 'conteo'>;
}

const casos = hoja.casos as Caso[];
const cursos = hoja.cursos as Curso[];

/** Columnas que el libro trunca a centésimas: deben coincidir exactamente. */
const TRUNCADAS = ['componente70', 'componenteProyecto15', 'componenteExamen15', 'notaFinal'] as const;
/** Promedios sin truncar: pueden ser periódicos (8,333…), se comparan con 10 decimales. */
const PROMEDIOS = ['promedioBloque1', 'promedioBloque2', 'promedioGeneral', 'promedioConRefuerzo'] as const;
const DECISIONES = ['cualitativo', 'estandar', 'requiereRefuerzo', 'alertaPromedioBajo'] as const;

describe('Hoja oficial anonimizada (I-05)', () => {
  it('trae todos los casos que declara', () => {
    expect(casos).toHaveLength(hoja.totalCasos);
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
  });

  describe.each([...new Set(casos.map((c) => c.grupo))])('%s', (grupo) => {
    it.each(casos.filter((c) => c.grupo === grupo))('$id · $descripcion', ({ entrada, esperado }) => {
      const resultado = calcularCalificacionInmediata(entrada);

      for (const columna of TRUNCADAS) {
        expect(resultado[columna], columna).toBe(esperado[columna]);
      }
      for (const columna of PROMEDIOS) {
        if (esperado[columna] === null) {
          expect(resultado[columna], columna).toBeNull();
        } else {
          expect(resultado[columna], columna).toBeCloseTo(esperado[columna], 10);
        }
      }
      for (const columna of DECISIONES) {
        expect(resultado[columna], columna).toBe(esperado[columna]);
      }
    });
  });

  // Hoja de estándares por curso: DA, AA, PA y NA, calificados y estudiantes con refuerzo
  it.each(cursos)('hoja de estándares de $curso', ({ casos: ids, esperado }) => {
    const resultados = casos
      .filter((c) => ids.includes(c.id))
      .map((c) => calcularCalificacionInmediata(c.entrada));

    expect(calcularResumenEstandares(resultados)).toMatchObject(esperado);
  });
});
