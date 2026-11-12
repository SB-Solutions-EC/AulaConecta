import { crearAplicacionReal } from './aplicacion-real';
import { construirMundo, Mundo, verificarPrivacidad } from './verificar-privacidad';

// Suite de privacidad (RNF-04) contra los endpoints REALES de matrícula y personas (T1111-M).
// Necesita todas las rutas del escenario; mientras falte alguna, la suite completa aparece como omitida
// y, en cuanto existan, se ejecuta sola y bloquea el PR si alguien llega a datos ajenos.

const RUTAS_DEL_ESCENARIO: ['get' | 'post', string][] = [
  ['post', '/anios-lectivos'],
  ['post', '/cursos'],
  ['post', '/personas'],
  ['post', '/representaciones'],
  ['post', '/matriculas'],
  ['get', '/matriculas'],
  ['get', '/personas'],
];

describe('Privacidad (RNF-04): endpoints reales de ms-academico', async () => {
  const real = await crearAplicacionReal();
  const faltan = [];
  for (const [metodo, ruta] of RUTAS_DEL_ESCENARIO) {
    if (!(await real.montado(metodo, ruta))) {
      faltan.push(`${metodo.toUpperCase()} ${ruta}`);
    }
  }

  afterAll(async () => {
    await real.cerrar();
  });

  describe.skipIf(faltan.length > 0)(`personas, representaciones y matrículas${faltan.length ? ` (se omite: faltan ${faltan.join(', ')})` : ''}`, () => {
    let mundo: Mundo;

    beforeAll(async () => {
      mundo = await construirMundo(real.servidor());
    });

    verificarPrivacidad(real.servidor, () => mundo);
  });
});
