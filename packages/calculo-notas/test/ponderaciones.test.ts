import { describe, expect, it } from 'vitest';
import base from '../casos/hoja-oficial-anonimizada.json';
import escenariosJson from '../casos/ponderaciones-hoja-oficial.json';
import {
  PONDERACIONES_OFICIALES,
  calcularCalificacionInmediata,
  validarPonderaciones,
  type EntradaCalculoNota,
  type PonderacionesCalificacion,
} from '../src/index';

// RNF-10 (T1125-A): al cambiar una ponderación, las notas se recalculan. Los valores esperados salen de
// casos/generar_casos_ponderaciones.py (fracciones exactas), que parte de la hoja oficial anonimizada.

interface FilaBase {
  id: string;
  entrada: EntradaCalculoNota;
}

interface Escenario {
  nombre: string;
  ponderaciones: PonderacionesCalificacion;
  filas: Record<string, Record<string, number | string | boolean>>;
}

const entradas = new Map((base.casos as FilaBase[]).map((c) => [c.id, c.entrada]));
const escenarios = escenariosJson.escenarios as Escenario[];
const COLUMNAS = ['componente70', 'componenteProyecto15', 'componenteExamen15', 'notaFinal', 'cualitativo', 'estandar', 'alertaPromedioBajo'] as const;

describe('Ponderaciones: las notas se recalculan al cambiarlas (RNF-10)', () => {
  it('trae todas las filas que declara en cada escenario', () => {
    expect(escenarios).toHaveLength(5);
    for (const escenario of escenarios) {
      expect(Object.keys(escenario.filas)).toHaveLength(escenariosJson.totalFilas);
    }
  });

  it('las ponderaciones oficiales son 70 / 15 / 15', () => {
    expect(PONDERACIONES_OFICIALES).toEqual({ aportes: 70, proyecto: 15, examen: 15 });
  });

  it('sin indicar ponderaciones se usan las oficiales, igual que indicándolas', () => {
    for (const entrada of entradas.values()) {
      expect(calcularCalificacionInmediata(entrada)).toEqual(calcularCalificacionInmediata(entrada, PONDERACIONES_OFICIALES));
    }
  });

  describe.each(escenarios)('$nombre', ({ ponderaciones, filas }) => {
    it.each(Object.entries(filas))('%s', (id, esperado) => {
      const resultado = calcularCalificacionInmediata(entradas.get(id) as EntradaCalculoNota, ponderaciones);

      for (const columna of COLUMNAS) {
        expect(resultado[columna], columna).toBe(esperado[columna]);
      }
    });

    it('cambiar la ponderación cambia la nota de la mayoría de los estudiantes', () => {
      const cambian = Object.keys(filas).filter(
        (id) => calcularCalificacionInmediata(entradas.get(id) as EntradaCalculoNota, ponderaciones).notaFinal !== calcularCalificacionInmediata(entradas.get(id) as EntradaCalculoNota).notaFinal,
      );

      expect(cambian.length).toBeGreaterThan(Object.keys(filas).length / 2);
    });

    it('volver a las ponderaciones oficiales devuelve las notas de antes', () => {
      for (const id of Object.keys(filas)) {
        const entrada = entradas.get(id) as EntradaCalculoNota;
        const antes = calcularCalificacionInmediata(entrada);
        calcularCalificacionInmediata(entrada, ponderaciones);

        expect(calcularCalificacionInmediata(entrada, PONDERACIONES_OFICIALES)).toEqual(antes);
      }
    });
  });

  it('con 100 / 0 / 0 la nota final es solo el componente de aportes', () => {
    const entrada = { aportesBloque1: [8, 9], aportesBloque2: [7, 8], refuerzo: null, notaProyecto: 1, notaExamen: 2 };

    const resultado = calcularCalificacionInmediata(entrada, { aportes: 100, proyecto: 0, examen: 0 });

    expect(resultado).toMatchObject({ componente70: 8, componenteProyecto15: 0, componenteExamen15: 0, notaFinal: 8 });
  });

  it('el escenario de RNF-10: 70/15/15 pasa a 60/20/20 y la nota de un estudiante se recalcula', () => {
    const entrada = { aportesBloque1: [8, 8, 8, 8, 8], aportesBloque2: [8, 8, 8, 8, 8], refuerzo: null, notaProyecto: 10, notaExamen: 9 };

    expect(calcularCalificacionInmediata(entrada).notaFinal).toBe(8.45);
    expect(calcularCalificacionInmediata(entrada, { aportes: 60, proyecto: 20, examen: 20 }).notaFinal).toBe(8.6);
  });
});

describe('validarPonderaciones', () => {
  it.each<[string, Record<string, unknown>]>([
    ['las oficiales', { aportes: 70, proyecto: 15, examen: 15 }],
    ['el cambio de RNF-10', { aportes: 60, proyecto: 20, examen: 20 }],
    ['solo aportes', { aportes: 100, proyecto: 0, examen: 0 }],
    ['con decimales que en coma flotante no suman 100', { aportes: 33.33, proyecto: 33.33, examen: 33.34 }],
    ['decimales cuya suma en coma flotante da 99,99999999999999', { aportes: 18.08, proyecto: 0.07, examen: 81.85 }],
    ['una ponderación extra se ignora', { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 }],
  ])('acepta %s', (_nombre, valor) => {
    expect(validarPonderaciones(valor)).toEqual([]);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['no suman 100 (por defecto)', { aportes: 60, proyecto: 20, examen: 19.99 }, 'las ponderaciones deben sumar 100 %'],
    ['suman más de 100', { aportes: 70, proyecto: 15, examen: 15.01 }, 'las ponderaciones deben sumar 100 %'],
    ['una es negativa aunque la suma dé 100', { aportes: 110, proyecto: -5, examen: -5 }, 'proyecto debe ser un porcentaje de 0 a 100'],
    ['una pasa de 100', { aportes: 101, proyecto: 0, examen: -1 }, 'aportes debe ser un porcentaje de 0 a 100'],
    ['una llega como texto', { aportes: '60', proyecto: 20, examen: 20 }, 'aportes debe ser un porcentaje de 0 a 100'],
    ['una es null', { aportes: 60, proyecto: null, examen: 40 }, 'proyecto debe ser un porcentaje de 0 a 100'],
    ['una es NaN', { aportes: Number.NaN, proyecto: 50, examen: 50 }, 'aportes debe ser un porcentaje de 0 a 100'],
    ['una es infinita', { aportes: 60, proyecto: 20, examen: Number.POSITIVE_INFINITY }, 'examen debe ser un porcentaje de 0 a 100'],
    ['falta una', { aportes: 60, proyecto: 40 }, 'examen debe ser un porcentaje de 0 a 100'],
    ['más de 2 decimales', { aportes: 60.001, proyecto: 19.999, examen: 20 }, 'aportes admite hasta 2 decimales'],
  ])('rechaza si %s', (_nombre, valor, mensaje) => {
    expect(validarPonderaciones(valor)).toContain(mensaje);
  });
});
