import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles, UsuarioActual } from '../src/autenticacion/guardia-jwt';
import { UsuarioToken, VerificadorJwt } from '../src/autenticacion/verificador-jwt';
import { JWKS, Reclamos, tokenValido, tokensRechazados } from './seguridad/tokens';

// Guardia JWT real (T1105-M): tokens de ms-identidad validados con su JWKS publicado en un servidor local.

@Controller('prueba-guardia')
class ControladorPrueba {
  @Get('sesion')
  sesion(@UsuarioActual() usuario: UsuarioToken): UsuarioToken {
    return usuario;
  }

  @Get('solo-admin')
  @Roles('ADMIN')
  soloAdmin(): { ok: boolean } {
    return { ok: true };
  }
}

let descargasJwks = 0;
let servidorJwks: Server;
let app: INestApplication;
const servidor = (): Server => app.getHttpServer() as Server;
const conToken = (ruta: string, token: string): request.Test => request(servidor()).get(ruta).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  servidorJwks = createServer((peticion, respuesta) => {
    descargasJwks++;
    respuesta.writeHead(peticion.url === '/.well-known/jwks.json' ? 200 : 404, { 'Content-Type': 'application/json' });
    respuesta.end(JSON.stringify(JWKS));
  });
  await new Promise<void>((listo) => servidorJwks.listen(0, '127.0.0.1', listo));
  const { port } = servidorJwks.address() as AddressInfo;
  process.env.AULACONECTA_JWKS_URL = `http://127.0.0.1:${port}/.well-known/jwks.json`;

  const modulo = await Test.createTestingModule({ imports: [AppModule], controllers: [ControladorPrueba] }).compile();
  app = modulo.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
  servidorJwks.close();
});

describe('Guardia JWT de ms-academico', () => {
  it('deja pasar /health sin token (ruta pública)', async () => {
    await request(servidor()).get('/health').expect(200);
  });

  it('acepta un token válido y entrega el usuario al controlador', async () => {
    const respuesta = await conToken('/prueba-guardia/sesion', tokenValido(['DOCENTE'])).expect(200);

    expect(respuesta.body).toEqual({ id: expect.any(String), roles: ['DOCENTE'], debeCambiarClave: false });
  });

  for (const { nombre, cabecera } of tokensRechazados()) {
    it(`responde 401 con ErrorApi: ${nombre}`, async () => {
      const peticion = request(servidor()).get('/prueba-guardia/sesion');
      const respuesta = await (cabecera === undefined ? peticion : peticion.set('Authorization', cabecera));

      expect(respuesta.status).toBe(401);
      expect(respuesta.body).toMatchObject({ codigo: 'NO_AUTORIZADO', mensaje: expect.any(String), timestamp: expect.any(String) });
    });
  }

  it('rechaza los tokens de servicio en la API de usuarios', async () => {
    const token = tokenValido(['ADMIN'], { tipo: 'servicio' } as Reclamos);

    const respuesta = await conToken('/prueba-guardia/sesion', token);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('NO_AUTORIZADO');
  });

  it('acepta el reclamo tipo = usuario', async () => {
    const respuesta = await conToken('/prueba-guardia/sesion', tokenValido(['DOCENTE'], { tipo: 'usuario' } as Reclamos));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.roles).toEqual(['DOCENTE']);
  });

  it('rechaza roles que no son una lista de textos', async () => {
    const comoTexto = await conToken('/prueba-guardia/sesion', tokenValido([], { roles: 'ADMIN' }));
    const conNumeros = await conToken('/prueba-guardia/sesion', tokenValido([], { roles: [1] }));

    expect(comoTexto.status).toBe(401);
    expect(conNumeros.status).toBe(401);
  });

  it('con la clave inicial pendiente responde 403 CAMBIO_CLAVE_PENDIENTE', async () => {
    const respuesta = await conToken('/prueba-guardia/sesion', tokenValido(['ADMIN'], { debe_cambiar_clave: true })).expect(403);

    expect(respuesta.body.codigo).toBe('CAMBIO_CLAVE_PENDIENTE');
  });

  it('limita la ruta a los roles indicados con @Roles', async () => {
    const respuesta = await conToken('/prueba-guardia/solo-admin', tokenValido(['DOCENTE'])).expect(403);

    expect(respuesta.body.codigo).toBe('ACCESO_DENEGADO');
    await conToken('/prueba-guardia/solo-admin', tokenValido(['DOCENTE', 'ADMIN'])).expect(200);
  });

  it('guarda el JWKS en memoria: muchas peticiones, una sola descarga', async () => {
    const antes = descargasJwks;
    await Promise.all(Array.from({ length: 10 }, () => conToken('/prueba-guardia/sesion', tokenValido(['DOCENTE'])).expect(200)));

    expect(descargasJwks - antes).toBe(0);
  });
});

describe('VerificadorJwt sin acceso a ms-identidad', () => {
  it('responde 401 (nunca 500) si no puede descargar el JWKS', async () => {
    const verificador = new VerificadorJwt(
      new ConfigService({ jwt: { jwksUrl: 'http://127.0.0.1:1/.well-known/jwks.json', emisor: 'aulaconecta-identidad', audiencia: 'aulaconecta' } }),
    );

    await expect(verificador.verificar(`Bearer ${tokenValido(['ADMIN'])}`)).rejects.toMatchObject({ status: 401, codigo: 'NO_AUTORIZADO' });
  });
});
