import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { ClienteIdentidad } from '../../src/identidad/cliente-identidad';
import { IdentidadFalsa } from './identidad-falsa';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { construirMundo, Mundo, verificarPrivacidad } from './verificar-privacidad';

// La suite de privacidad contra la implementación de referencia, sobre AppModule.
// Si algo falla aquí, el error está en la suite o en la configuración global, no en los endpoints reales.
describe('Privacidad (RNF-04): implementación de referencia de personas y matrícula', () => {
  let app: INestApplication;
  let mundo: Mundo;
  const identidad = new IdentidadFalsa();
  const servidor = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule, ModuloReferencia, ModuloMatriculaReferencia] })
      .overrideProvider(ClienteIdentidad)
      .useValue(identidad)
      .compile();
    app = modulo.createNestApplication({ logger: false });
    await app.init();
    mundo = await construirMundo(servidor());
  });

  afterAll(async () => {
    await app.close();
  });

  it('cada alta pidió su cuenta a ms-identidad con el rol que corresponde y la cédula solo como clave inicial', () => {
    const personas = [mundo.estudianteA, mundo.estudianteB, mundo.estudianteC, mundo.representanteA, mundo.representanteB, mundo.representanteAC];
    for (const persona of personas) {
      const solicitud = identidad.recibidas.find((s) => s.id === persona.personaId);
      expect(solicitud?.cedulaInicial).toBe(persona.cedula);
      expect(persona.usuarioId).toBe(persona.personaId);
    }
    expect(identidad.recibidas.filter((s) => s.roles.includes('ESTUDIANTE'))).toHaveLength(3);
  });

  verificarPrivacidad(servidor, () => mundo);
});
