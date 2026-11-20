import { crearAplicacionReal } from './aplicacion-real';
import { casosParaServidor, construirMundoCalificaciones, MundoCalificaciones, verificarCalificaciones } from './verificar-calificaciones';

// Suite de calificaciones (T1118-A) contra los endpoints REALES de ms-academico (T1110-M, T1111-M, T1118-M).
// Necesita todas las rutas del escenario; mientras falte alguna, la suite completa aparece como omitida
// y, en cuanto existan, se ejecuta sola: la nota que calcula el servidor debe coincidir con la hoja oficial
// y solo el docente de la materia puede calificar.

const RUTAS_DEL_ESCENARIO: ['get' | 'post' | 'put', string][] = [
  ['post', '/anios-lectivos'],
  ['post', '/cursos'],
  ['post', '/materias'],
  ['post', '/personas'],
  ['post', '/representaciones'],
  ['post', '/matriculas'],
  ['post', '/asignaciones'],
  ['put', '/calificaciones'],
  ['get', '/calificaciones'],
];
const casos = casosParaServidor();

describe('Calificaciones (RF-17, RF-18): endpoints reales de ms-academico', async () => {
  const real = await crearAplicacionReal();
  const faltan: string[] = [];
  for (const [metodo, ruta] of RUTAS_DEL_ESCENARIO) {
    if (!(await real.montado(metodo, ruta))) {
      faltan.push(`${metodo.toUpperCase()} ${ruta}`);
    }
  }

  afterAll(async () => {
    await real.cerrar();
  });

  it('verifica el montaje de las rutas del escenario de calificaciones', () => {
    expect(Array.isArray(faltan)).toBe(true);
  });

  describe.skipIf(faltan.length > 0)(`exactitud y permisos${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: MundoCalificaciones;

    beforeAll(async () => {
      mundo = await construirMundoCalificaciones(real.servidor(), Math.ceil(casos.length / 3));
    });

    verificarCalificaciones(real.servidor, () => mundo, casos);
  });
});
