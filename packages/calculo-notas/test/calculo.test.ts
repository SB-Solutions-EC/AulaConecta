import { describe, expect, it } from 'vitest';
import {
  calcularCalificacionInmediata,
  calcularResumenEstandares,
  normalizarNotaEntrada,
  obtenerCualitativo,
  truncarADosDecimales,
} from '../src/index';

describe('Motor de cálculo de notas (T1117-C, movido a packages/calculo-notas en T1117-A)', () => {
  it('trunca a 2 decimales igual que TRUNC(,2) sin error binario IEEE-754', () => {
    expect(truncarADosDecimales(8.2 * 0.7)).toBe(5.74);
    expect(truncarADosDecimales(8.999)).toBe(8.99);
    expect(truncarADosDecimales(10)).toBe(10);
  });

  it('un curso sin estudiantes calificados no tiene promedio (T1117-A)', () => {
    const sinNotaFinal = calcularCalificacionInmediata({ aportesBloque1: [8], aportesBloque2: [8], notaProyecto: 8 });

    expect(calcularResumenEstandares([])).toMatchObject({ totalEstudiantes: 0, calificados: 0, promedioCurso: null });
    expect(calcularResumenEstandares([sinNotaFinal])).toMatchObject({ totalEstudiantes: 1, calificados: 0, promedioCurso: null });
  });

  it('con negativos trunca hacia cero como TRUNC(,2) de Excel y los califica E- (T1117-A)', () => {
    // Una nota negativa no se puede ingresar (normalizarNotaEntrada la rechaza); esto fija el comportamiento
    expect(truncarADosDecimales(-1.239)).toBe(-1.23);
    expect(truncarADosDecimales(-8.2 * 0.7)).toBe(-5.74);
    expect(obtenerCualitativo(-0.5)).toBe('E-');
    expect(obtenerCualitativo(Number.NaN)).toBeNull();
  });

  it('calcula ponderación 70/15/15, cualitativo y estándar sin refuerzo', () => {
    const resultado = calcularCalificacionInmediata({
      aportesBloque1: [8, 9, 8.5, 8.5, 9],
      aportesBloque2: [8, 8, 9, 8, 9],
      refuerzo: null,
      notaProyecto: 9,
      notaExamen: 8.5,
    });

    expect(resultado.promedioBloque1).toBe(8.6);
    expect(resultado.promedioBloque2).toBe(8.4);
    expect(resultado.promedioGeneral).toBe(8.5);
    expect(resultado.componente70).toBe(5.95);
    expect(resultado.componenteProyecto15).toBe(1.35);
    expect(resultado.componenteExamen15).toBe(1.27);
    expect(resultado.notaFinal).toBe(8.57);
    expect(resultado.cualitativo).toBe('B+');
    expect(resultado.estandar).toBe('AA');
    expect(resultado.requiereRefuerzo).toBe(false);
    expect(resultado.alertaPromedioBajo).toBe(false);
  });

  it('promedia el refuerzo académico opcional con el promedio general y marca alerta si baja de 7', () => {
    const conRefuerzo = calcularCalificacionInmediata({
      aportesBloque1: [6, 6],
      aportesBloque2: [6, 6],
      refuerzo: 8,
      notaProyecto: 7,
      notaExamen: 7,
    });

    expect(conRefuerzo.promedioGeneral).toBe(6);
    expect(conRefuerzo.promedioConRefuerzo).toBe(7);
    expect(conRefuerzo.componente70).toBe(4.9);
    expect(conRefuerzo.componenteProyecto15).toBe(1.05);
    expect(conRefuerzo.componenteExamen15).toBe(1.05);
    expect(conRefuerzo.notaFinal).toBe(7);
    expect(conRefuerzo.cualitativo).toBe('B-');
    expect(conRefuerzo.requiereRefuerzo).toBe(true);
    expect(conRefuerzo.alertaPromedioBajo).toBe(false);

    const bajoSiete = calcularCalificacionInmediata({
      aportesBloque1: [5.5],
      aportesBloque2: [6.0],
      refuerzo: null,
      notaProyecto: 6,
      notaExamen: 6,
    });
    expect(bajoSiete.notaFinal).toBeLessThan(7);
    expect(bajoSiete.alertaPromedioBajo).toBe(true);
  });

  it('cubre la escala cualitativa A+ a E- y valida notas de entrada', () => {
    expect(obtenerCualitativo(10)).toBe('A+');
    expect(obtenerCualitativo(9.5)).toBe('A-');
    expect(obtenerCualitativo(8.1)).toBe('B+');
    expect(obtenerCualitativo(7.0)).toBe('B-');
    expect(obtenerCualitativo(6.4)).toBe('C+');
    expect(obtenerCualitativo(5.0)).toBe('C-');
    expect(obtenerCualitativo(4.2)).toBe('D+');
    expect(obtenerCualitativo(3.9)).toBe('D-');
    expect(obtenerCualitativo(2.0)).toBe('E+');
    expect(obtenerCualitativo(1.5)).toBe('E-');
    expect(obtenerCualitativo(null)).toBeNull();

    expect(normalizarNotaEntrada('8,5')).toBe(8.5);
    expect(normalizarNotaEntrada('')).toBeNull();
    expect(normalizarNotaEntrada('11')).toBeNull();
    expect(normalizarNotaEntrada('-1')).toBeNull();
  });

  it('resume estándares DA/AA/PA/NA y promedio del curso', () => {
    const r1 = calcularCalificacionInmediata({
      aportesBloque1: [9.5],
      aportesBloque2: [9.5],
      notaProyecto: 10,
      notaExamen: 9,
    });
    const r2 = calcularCalificacionInmediata({
      aportesBloque1: [6],
      aportesBloque2: [6],
      notaProyecto: 6,
      notaExamen: 6,
    });

    const resumen = calcularResumenEstandares([r1, r2]);
    expect(resumen.totalEstudiantes).toBe(2);
    expect(resumen.calificados).toBe(2);
    expect(resumen.requierenRefuerzo).toBe(1);
    expect(resumen.conteo.DA).toBe(1);
    expect(resumen.conteo.PA).toBe(1);
    expect(resumen.promedioCurso).not.toBeNull();
  });
});
