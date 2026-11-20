import { randomUUID } from 'node:crypto';
import { crearAplicacionReal } from './aplicacion-real';
import { construirMundoTareas, MundoTareas, verificarTareas } from './verificar-tareas';

// Suite de tareas (T1119-A) contra los endpoints REALES de ms-academico (T1110-M, T1111-M, T1119-M).
// Necesita todas las rutas del escenario; mientras falte alguna, la suite completa aparece como omitida
// y, en cuanto existan, se ejecuta sola: solo el docente de la asignación crea y califica, el texto se
// guarda literal o se rechaza, los enlaces son http(s) y cada estudiante ve solo su nota.

const RUTAS_DEL_ESCENARIO: ['get' | 'post' | 'put', string][] = [
  ['post', '/anios-lectivos'],
  ['post', '/periodos'],
  ['post', '/cursos'],
  ['post', '/materias'],
  ['post', '/personas'],
  ['post', '/representaciones'],
  ['post', '/matriculas'],
  ['post', '/asignaciones'],
  ['post', '/tareas'],
  ['get', '/tareas'],
  ['put', `/tareas/${randomUUID()}/entregas`],
  ['get', `/tareas/${randomUUID()}/entregas`],
];

describe('Tareas (RF-19, RF-20): endpoints reales de ms-academico', async () => {
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

  it('verifica el montaje de las rutas del escenario de tareas', () => {
    expect(Array.isArray(faltan)).toBe(true);
  });

  describe.skipIf(faltan.length > 0)(`autorización y saneamiento${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: MundoTareas;

    beforeAll(async () => {
      mundo = await construirMundoTareas(real.servidor());
    });

    verificarTareas(real.servidor, () => mundo);
  });
});
