import request from 'supertest';
import { crearAplicacionReal } from './aplicacion-real';
import { CREACIONES, LISTADOS } from './endpoints-academicos';
import { verificarCreacion, verificarListado } from './verificar-endpoint';

// La misma suite contra los endpoints REALES de ms-academico (AppModule).
// Un endpoint que todavía no existe aparece como omitido en el reporte; en cuanto se monte,
// sus pruebas se ejecutan solas y bloquean el PR si algo no se valida.

// Vitest espera a esta función antes de decidir qué pruebas se ejecutan y cuáles se omiten
describe('Suite de seguridad: endpoints reales de ms-academico', async () => {
  const real = await crearAplicacionReal();
  const creaciones = await Promise.all(CREACIONES.map(async (e) => ({ e, existe: await real.montado('post', e.ruta) })));
  const listados = await Promise.all(LISTADOS.map(async (e) => ({ e, existe: await real.montado('get', e.ruta) })));

  afterAll(async () => {
    await real.cerrar();
  });

  it('la configuración global responde rutas desconocidas con ErrorApi y sin repetir la ruta', async () => {
    const respuesta = await request(real.servidor()).post('/no-existe').send({ a: 1 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toMatchObject({ codigo: 'NO_ENCONTRADO', mensaje: expect.any(String) });
    expect(respuesta.text).not.toContain('/no-existe');
  });

  for (const { e, existe } of creaciones) {
    describe.skipIf(!existe)(`${e.operacion} (se omite mientras no exista POST ${e.ruta})`, () => {
      verificarCreacion(real.servidor, e);
    });
  }
  for (const { e, existe } of listados) {
    describe.skipIf(!existe)(`${e.operacion} (se omite mientras no exista GET ${e.ruta})`, () => {
      verificarListado(real.servidor, e);
    });
  }
});
