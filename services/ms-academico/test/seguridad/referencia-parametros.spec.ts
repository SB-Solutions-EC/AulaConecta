import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloCalificacionesReferencia } from './referencia/modulo-calificaciones-referencia';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloParametrosReferencia } from './referencia/modulo-parametros-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { construirMundoCalificaciones, MundoCalificaciones } from './verificar-calificaciones';
import { escenariosParaServidor, verificarParametros } from './verificar-parametros';

// La suite de parámetros (T1125-A, RNF-10) contra la implementación de referencia, sobre NucleoModule
// (la guardia JWT real, sin los endpoints reales). Si algo falla aquí, el error está en la suite.
const datos = escenariosParaServidor();

describe('Parámetros (RNF-10): implementación de referencia', () => {
  let real: AplicacionReal;
  let mundo: MundoCalificaciones;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia, ModuloCalificacionesReferencia, ModuloParametrosReferencia]);
    mundo = await construirMundoCalificaciones(servidor(), Math.ceil(datos.casos.length / 3));
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('usa todas las filas de la hoja oficial que admite el contrato en los cinco escenarios de ponderaciones', () => {
    expect(datos.casos.length).toBeGreaterThan(140);
    expect(datos.otros).toHaveLength(5);
    expect(datos.otros.map((e) => Object.keys(e.filas).length)).toEqual(Array(5).fill(datos.casos.length));
  });

  verificarParametros(servidor, () => mundo, datos);
});
