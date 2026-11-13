import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { CREACIONES, LISTADOS } from './endpoints-academicos';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { verificarCreacion, verificarListado } from './verificar-endpoint';

// La suite de seguridad contra la implementación de referencia, montada sobre AppModule
// (misma validación, filtro de errores y middleware que producción). Si algo falla aquí,
// el error está en la suite o en la configuración global, no en los endpoints reales.
describe('Suite de seguridad: implementación de referencia de RF-06 y RF-07', () => {
  let app: INestApplication;
  const servidor = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule, ModuloReferencia] }).compile();
    app = modulo.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('inicializa AppModule con ModuloReferencia', () => {
    expect(app).toBeDefined();
  });

  for (const endpoint of CREACIONES) {
    verificarCreacion(servidor, endpoint);
  }
  for (const endpoint of LISTADOS) {
    verificarListado(servidor, endpoint);
  }
});
