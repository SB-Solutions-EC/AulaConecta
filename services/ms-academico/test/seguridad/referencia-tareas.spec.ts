import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloCalificacionesReferencia } from './referencia/modulo-calificaciones-referencia';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { ModuloTareasReferencia } from './referencia/modulo-tareas-referencia';
import { construirMundoTareas, MundoTareas, verificarTareas } from './verificar-tareas';

// La suite de tareas (T1119-A) contra la implementación de referencia, sobre NucleoModule
// (la guardia JWT real, sin los endpoints reales). Si algo falla aquí, el error está en la suite.
describe('Tareas (RF-19, RF-20): implementación de referencia', () => {
  let real: AplicacionReal;
  let mundo: MundoTareas;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia, ModuloCalificacionesReferencia, ModuloTareasReferencia]);
    mundo = await construirMundoTareas(servidor());
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('arma el escenario con una tarea creada por el docente de la asignación', () => {
    expect(mundo.tarea).toMatch(/^[0-9a-f-]{36}$/);
  });

  verificarTareas(servidor, () => mundo);
});
