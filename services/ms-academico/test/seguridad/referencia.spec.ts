import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { CREACIONES, LISTADOS } from './endpoints-academicos';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { verificarCreacion, verificarListado } from './verificar-endpoint';

// La suite de seguridad contra la implementación de referencia, montada sobre NucleoModule
// (misma guardia JWT, validación, filtro de errores y middleware que producción). Si algo falla aquí,
// el error está en la suite o en la configuración global, no en los endpoints reales.
describe('Suite de seguridad: implementación de referencia de RF-06 y RF-07', () => {
  let real: AplicacionReal;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia]);
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('monta la referencia sobre el núcleo y su guardia JWT', async () => {
    expect(await real.montado('post', '/materias')).toBe(true);
  });

  for (const endpoint of CREACIONES) {
    verificarCreacion(servidor, endpoint);
  }
  for (const endpoint of LISTADOS) {
    verificarListado(servidor, endpoint);
  }
});
