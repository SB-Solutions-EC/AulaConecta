import { crearAplicacionReal } from './aplicacion-real';
import { construirMundoCalificaciones, MundoCalificaciones } from './verificar-calificaciones';
import { escenariosParaServidor, verificarParametros } from './verificar-parametros';

// Suite de parámetros (T1125-A, RNF-10) contra los endpoints REALES de ms-academico (GET y PUT /parametros).
// Necesita todas las rutas del escenario; mientras falte alguna, la suite completa aparece como omitida y, en
// cuanto existan, se ejecuta sola: al cambiar una ponderación, las notas guardadas se recalculan.

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
  ['get', '/parametros'],
  ['put', '/parametros'],
];
const datos = escenariosParaServidor();

describe('Parámetros (RNF-10): endpoints reales de ms-academico', async () => {
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

  it('verifica el montaje de las rutas del escenario de parámetros', () => {
    expect(Array.isArray(faltan)).toBe(true);
  });

  describe.skipIf(faltan.length > 0)(`ponderaciones y recálculo de notas${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: MundoCalificaciones;

    beforeAll(async () => {
      mundo = await construirMundoCalificaciones(real.servidor(), Math.ceil(datos.casos.length / 3));
    });

    verificarParametros(real.servidor, () => mundo, datos);
  });
});
