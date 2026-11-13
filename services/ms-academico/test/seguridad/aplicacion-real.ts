import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClienteIdentidad } from '../../src/identidad/cliente-identidad';
import { IdentidadFalsa } from './identidad-falsa';
import { JWKS } from './tokens';

// Arma ms-academico REAL (AppModule) para las suites de seguridad y privacidad.
//
// La guardia JWT real debe aceptar los tokens de ./tokens.ts: aquí se publica su JWKS en un
// servidor local y se pasa la URL en AULACONECTA_JWKS_URL. Si la guardia usa otra variable
// o el emisor/audiencia vienen de la configuración, se ajusta solo este archivo.
// ms-identidad no se levanta: ClienteIdentidad se reemplaza por IdentidadFalsa.

export interface AplicacionReal {
  app: INestApplication;
  servidor: () => Server;
  identidad: IdentidadFalsa;
  /** Una ruta sin controlador responde 404 aun sin token ni cuerpo. */
  montado: (metodo: 'get' | 'post', ruta: string) => Promise<boolean>;
  cerrar: () => Promise<void>;
}

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

export async function crearAplicacionReal(): Promise<AplicacionReal> {
  const servidorJwks = await publicarJwks();
  const identidad = new IdentidadFalsa();
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClienteIdentidad)
    .useValue(identidad)
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  await app.init();
  const servidor = (): Server => app.getHttpServer() as Server;

  return {
    app,
    servidor,
    identidad,
    montado: async (metodo, ruta) => (await request(servidor())[metodo](ruta)).status !== 404,
    cerrar: async () => {
      await app.close();
      servidorJwks.close();
    },
  };
}
