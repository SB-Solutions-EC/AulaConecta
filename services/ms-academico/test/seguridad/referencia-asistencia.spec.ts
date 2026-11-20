import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloAsistenciaReferencia } from './referencia/modulo-asistencia-referencia';
import { ModuloCalificacionesReferencia } from './referencia/modulo-calificaciones-referencia';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { construirMundoAsistencia, MundoAsistencia, verificarAsistencia } from './verificar-asistencia';

// La suite de asistencia y justificación (T1123-A) contra la implementación de referencia, sobre
// NucleoModule (la guardia JWT real, sin los endpoints reales). Si algo falla aquí, el error está en la suite.
describe('Asistencia y justificación (RF-21): implementación de referencia', () => {
  let real: AplicacionReal;
  let mundo: MundoAsistencia;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia, ModuloCalificacionesReferencia, ModuloAsistenciaReferencia]);
    mundo = await construirMundoAsistencia(servidor());
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('arma el escenario con estudiantes en dos cursos', () => {
    expect(new Set(Object.values(mundo.matricula)).size).toBe(3);
  });

  verificarAsistencia(servidor, () => mundo);
});
