import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CREACIONES, LISTADOS } from './endpoints-academicos';
import { JWKS } from './tokens';
import { verificarCreacion, verificarListado } from './verificar-endpoint';

// La misma suite contra los endpoints REALES de ms-academico (AppModule).
// Un endpoint que todavía no existe aparece como omitido en el reporte; en cuanto se monte,
// sus pruebas se ejecutan solas y bloquean el PR si algo no se valida.
//
// La guardia JWT real debe aceptar los tokens de ./tokens.ts: aquí se publica su JWKS en un
// servidor local y se pasa la URL en AULACONECTA_JWKS_URL. Si la guardia usa otra variable
// o el emisor/audiencia vienen de la configuración, se ajusta solo este archivo.

async function publicarJwks(): Promise<Server> {
  const servidorJwks = createServer((peticion, respuesta) => {
    respuesta.writeHead(peticion.url === '/.well-known/jwks.json' ? 200 : 404, { 'Content-Type': 'application/json' });
    respuesta.end(JSON.stringify(JWKS));
  });
  await new Promise<void>((listo) => servidorJwks.listen(0, '127.0.0.1', listo));
  const { port } = servidorJwks.address() as AddressInfo;
  process.env.AULACONECTA_JWKS_URL = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  return servidorJwks;
}

// Vitest espera a esta función antes de decidir qué pruebas se ejecutan y cuáles se omiten
describe('Suite de seguridad: endpoints reales de ms-academico', async () => {
  const servidorJwks = await publicarJwks();
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = modulo.createNestApplication({ logger: false });
  await app.init();
  const servidor = (): Server => app.getHttpServer() as Server;

  // Una ruta sin controlador responde 404 aun sin token ni cuerpo
  const montado = async (metodo: 'get' | 'post', ruta: string): Promise<boolean> =>
    (await request(servidor())[metodo](ruta)).status !== 404;
  const creaciones = await Promise.all(CREACIONES.map(async (e) => ({ e, existe: await montado('post', e.ruta) })));
  const listados = await Promise.all(LISTADOS.map(async (e) => ({ e, existe: await montado('get', e.ruta) })));

  afterAll(async () => {
    await app.close();
    servidorJwks.close();
  });

  it('la configuración global responde rutas desconocidas con ErrorApi y sin repetir la ruta', async () => {
    const respuesta = await request(servidor()).post('/no-existe').send({ a: 1 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toMatchObject({ codigo: 'NO_ENCONTRADO', mensaje: expect.any(String) });
    expect(respuesta.text).not.toContain('/no-existe');
  });

  for (const { e, existe } of creaciones) {
    describe.skipIf(!existe)(`${e.operacion} (se omite mientras no exista POST ${e.ruta})`, () => {
      verificarCreacion(servidor, e);
    });
  }
  for (const { e, existe } of listados) {
    describe.skipIf(!existe)(`${e.operacion} (se omite mientras no exista GET ${e.ruta})`, () => {
      verificarListado(servidor, e);
    });
  }
});
