import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarSwagger } from '../src/swagger';

describe('ms-academico (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200 con el estado del servicio', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);

    expect(respuesta.body).toMatchObject({ status: 'UP', servicio: 'ms-academico' });
    expect(typeof respuesta.body.segundosActivo).toBe('number');
  });

  it('GET /docs-json publica el contrato OpenAPI con /health', async () => {
    const respuesta = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(respuesta.body.info.title).toBe('AulaConecta · ms-academico');
    expect(respuesta.body.paths).toHaveProperty('/health');
  });
});
