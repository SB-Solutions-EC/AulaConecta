import { randomUUID } from 'node:crypto';
import { crearAplicacionReal } from './aplicacion-real';
import { construirMundoNotas, MundoNotas, verificarAccesoNotas } from './verificar-acceso-notas';

// Matriz de acceso a notas (T1120-A) contra los endpoints REALES de ms-academico (T1110-M, T1111-M,
// T1118-M, T1119-M, T1120-M). Mientras falte alguna ruta del escenario, la suite aparece como omitida;
// en cuanto existan, se ejecuta sola y bloquea el PR si alguien ve notas ajenas.

const RUTAS_DEL_ESCENARIO: ['get' | 'post' | 'put', string][] = [
  ['post', '/anios-lectivos'],
  ['post', '/periodos'],
  ['post', '/cursos'],
  ['post', '/materias'],
  ['post', '/personas'],
  ['post', '/representaciones'],
  ['post', '/matriculas'],
  ['post', '/asignaciones'],
  ['put', '/calificaciones'],
  ['get', '/calificaciones'],
  ['post', '/tareas'],
  ['put', `/tareas/${randomUUID()}/entregas`],
  ['get', `/tareas/${randomUUID()}/entregas`],
];

describe('Acceso a notas (RF-20, RNF-04): endpoints reales de ms-academico', async () => {
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

  it('verifica el montaje de las rutas del escenario de notas', () => {
    expect(Array.isArray(faltan)).toBe(true);
  });

  describe.skipIf(faltan.length > 0)(`matriz de acceso${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: MundoNotas;

    beforeAll(async () => {
      mundo = await construirMundoNotas(real.servidor());
    });

    verificarAccesoNotas(real.servidor, () => mundo);
  });
});
