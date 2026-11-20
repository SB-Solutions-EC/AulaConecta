import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloCalificacionesReferencia } from './referencia/modulo-calificaciones-referencia';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { casosParaServidor, construirMundoCalificaciones, MundoCalificaciones, verificarCalificaciones } from './verificar-calificaciones';

// La suite de calificaciones (T1118-A) contra la implementación de referencia, sobre NucleoModule
// (la guardia JWT real, sin los endpoints reales). Si algo falla aquí, el error está en la suite.
const casos = casosParaServidor();

describe('Calificaciones (RF-17, RF-18): implementación de referencia', () => {
  let real: AplicacionReal;
  let mundo: MundoCalificaciones;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia, ModuloCalificacionesReferencia]);
    mundo = await construirMundoCalificaciones(servidor(), Math.ceil(casos.length / 3));
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('usa todas las filas de la hoja oficial que admite el contrato (con proyecto y examen)', () => {
    expect(casos.length).toBeGreaterThan(140);
  });

  verificarCalificaciones(servidor, () => mundo, casos);
});
