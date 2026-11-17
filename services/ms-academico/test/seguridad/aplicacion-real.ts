import { DynamicModule, INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ClienteIdentidad } from '../../src/identidad/cliente-identidad';
import { NucleoModule } from '../../src/nucleo.module';
import { IdentidadFalsa } from './identidad-falsa';
import { JWKS } from './tokens';

// Arma ms-academico REAL (AppModule, con su guardia JWT global) para las suites de seguridad,
// privacidad y carga, sobre el PostgreSQL de Testcontainers (test/postgres-global.ts).
// Con `modulos`, las implementaciones de referencia se montan sobre NucleoModule (la misma
// guardia, validación y filtro de errores, pero sin los endpoints reales, que les taparían las rutas).
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

export async function crearAplicacionReal(modulos: (Type<unknown> | DynamicModule)[] = []): Promise<AplicacionReal> {
  const servidorJwks = await publicarJwks();
  process.env.DATABASE_URL = inject('urlBaseDatos');
  const identidad = new IdentidadFalsa();
  const raiz = modulos.length ? NucleoModule : AppModule;
  const modulo = await Test.createTestingModule({ imports: [raiz, ...modulos] })
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
