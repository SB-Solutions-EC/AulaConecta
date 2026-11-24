import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloCalificacionesReferencia } from './referencia/modulo-calificaciones-referencia';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { ModuloTareasReferencia } from './referencia/modulo-tareas-referencia';
import { construirMundoNotas, MundoNotas, verificarAccesoNotas } from './verificar-acceso-notas';

// La matriz de acceso a notas (T1120-A) contra las implementaciones de referencia, sobre NucleoModule
// (la guardia JWT real, sin los endpoints reales). Si algo falla aquí, el error está en la suite.
describe('Acceso a notas (RF-20, RNF-04): implementación de referencia', () => {
  let real: AplicacionReal;
  let mundo: MundoNotas;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia, ModuloCalificacionesReferencia, ModuloTareasReferencia]);
    mundo = await construirMundoNotas(servidor());
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('arma el escenario con notas de tres estudiantes en dos cursos', () => {
    expect(new Set(Object.values(mundo.matricula)).size).toBe(3);
  });

  verificarAccesoNotas(servidor, () => mundo);
});
