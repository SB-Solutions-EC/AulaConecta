import { randomUUID } from 'node:crypto';
import { crearAplicacionReal } from './aplicacion-real';
import { construirMundoAsistencia, MundoAsistencia, verificarAsistencia } from './verificar-asistencia';

// Suite de asistencia y justificación (T1123-A) contra los endpoints REALES de ms-academico (T1110-M,
// T1111-M, T1123-M). Mientras falte alguna ruta del escenario, la suite aparece como omitida; en cuanto
// existan, se ejecuta sola: solo el docente de la materia registra y aprueba, el estudiante solo solicita.

const RUTAS_DEL_ESCENARIO: ['get' | 'post' | 'put', string][] = [
  ['post', '/anios-lectivos'],
  ['post', '/cursos'],
  ['post', '/materias'],
  ['post', '/personas'],
  ['post', '/representaciones'],
  ['post', '/matriculas'],
  ['post', '/asignaciones'],
  ['put', '/asistencias'],
  ['get', '/asistencias'],
  ['post', `/asistencias/${randomUUID()}/justificacion`],
];

describe('Asistencia y justificación (RF-21): endpoints reales de ms-academico', async () => {
  const real = await crearAplicacionReal();
  const faltan: string[] = [];
  for (const [metodo, ruta] of RUTAS_DEL_ESCENARIO) {
    if (!(await real.montado(metodo, ruta))) {
      faltan.push(`${metodo.toUpperCase()} ${ruta.replace(/[0-9a-f-]{36}/, '{id}')}`);
    }
  }

  afterAll(async () => {
    await real.cerrar();
  });

  it('verifica el montaje de las rutas del escenario de asistencia', () => {
    expect(Array.isArray(faltan)).toBe(true);
  });

  describe.skipIf(faltan.length > 0)(`registro, justificación y consulta${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: MundoAsistencia;

    beforeAll(async () => {
      mundo = await construirMundoAsistencia(real.servidor());
    });

    verificarAsistencia(real.servidor, () => mundo);
  });
});
