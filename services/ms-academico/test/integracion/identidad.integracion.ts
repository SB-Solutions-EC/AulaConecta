import { ConfigService } from '@nestjs/config';
import { createPublicKey, randomUUID, verify, type webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ExcepcionApi } from '../../src/comun/excepcion-api';
import { cargarConfiguracion, Configuracion } from '../../src/config/configuracion';
import { ClienteIdentidad, SolicitudCrearCuenta } from '../../src/identidad/cliente-identidad';

type JsonWebKey = webcrypto.JsonWebKey;

// Prueba de integración académico–identidad (T1110-A) contra un ms-identidad REAL con su PostgreSQL,
// levantados con infra/docker-compose.yml. La ejecuta el job "integracion" del CI; en local:
// ver "Prueba de integración" en el README de ms-academico.

const config: Configuracion = cargarConfiguracion();
const { url, secretoArchivo } = config.identidad;
if (!process.env.IDENTIDAD_URL || !secretoArchivo) {
  throw new Error('Faltan IDENTIDAD_URL y AULACONECTA_CLIENTE_SECRETO_ARCHIVO para la prueba de integración');
}

const cliente = new ClienteIdentidad({ getOrThrow: () => config.identidad } as unknown as ConfigService);
const secreto = (): string => readFileSync(secretoArchivo, 'utf8').trim();
// Provincia 99: no existe, no puede ser la cédula de una persona real
const CEDULA = '9900000001';

async function llamar(metodo: string, ruta: string, cuerpo?: object, token?: string): Promise<{ estado: number; json: Record<string, unknown> }> {
  const respuesta = await fetch(`${url}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

async function tokenDeServicio(clientId = 'ms-academico', clientSecret = secreto()): Promise<{ estado: number; json: Record<string, unknown> }> {
  return llamar('POST', '/oauth/token', { grantType: 'client_credentials', clientId, clientSecret });
}

const partes = (token: string): [Record<string, unknown>, Record<string, unknown>] => {
  const [cabecera, cuerpo] = token.split('.');
  return [JSON.parse(Buffer.from(cabecera, 'base64url').toString()), JSON.parse(Buffer.from(cuerpo, 'base64url').toString())];
};

describe('Integración ms-academico → ms-identidad con token de servicio', () => {
  const sufijo = randomUUID().slice(0, 6).replace(/\d/g, 'x');
  const docente: SolicitudCrearCuenta = {
    id: randomUUID(),
    nombres: 'Docente',
    apellidos: `Integracion${sufijo}`,
    cedulaInicial: CEDULA,
    roles: ['DOCENTE'],
  };
  let nombreUsuario: string;

  it('ms-academico pide su token y crea la cuenta de un docente con el mismo id de la persona', async () => {
    const cuenta = await cliente.crearCuenta(docente);

    expect(cuenta).toMatchObject({ id: docente.id, roles: ['DOCENTE'], estado: 'ACTIVO', debeCambiarClave: true });
    expect(cuenta.nombreUsuario).toMatch(new RegExp(`^docente\\.integracion${sufijo}\\d*$`));
    expect(JSON.stringify(cuenta)).not.toContain(CEDULA);
    nombreUsuario = cuenta.nombreUsuario;
  });

  it('el docente entra con su cédula como clave inicial y debe cambiarla (RF-03)', async () => {
    const { estado, json } = await llamar('POST', '/auth/login', { nombreUsuario, clave: CEDULA });

    expect(estado).toBe(200);
    expect(json.usuario).toMatchObject({ id: docente.id, debeCambiarClave: true });
    expect(partes(json.accessToken as string)[1]).toMatchObject({ tipo: 'usuario', roles: ['DOCENTE'] });
  });

  it('crear otra vez la misma persona devuelve 409 USUARIO_EXISTENTE', async () => {
    const error: unknown = await cliente.crearCuenta(docente).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExcepcionApi);
    expect((error as ExcepcionApi).getStatus()).toBe(409);
    expect((error as ExcepcionApi).codigo).toBe('USUARIO_EXISTENTE');
  });

  it('un nombre sin letras llega como 400 NOMBRE_INVALIDO desde ms-identidad', async () => {
    const error = (await cliente.crearCuenta({ ...docente, id: randomUUID(), nombres: '123', apellidos: '456' }).catch((e: unknown) => e)) as ExcepcionApi;

    expect([error.getStatus(), error.codigo]).toEqual([400, 'NOMBRE_INVALIDO']);
  });

  it('el token de servicio dura 5 minutos, solo trae su alcance y se valida con el JWKS publicado', async () => {
    const { estado, json } = await tokenDeServicio();
    expect(estado).toBe(200);
    expect(json).toMatchObject({ tokenType: 'Bearer', expiresIn: 300, scope: 'usuarios:crear' });

    const token = json.accessToken as string;
    const [cabecera, reclamos] = partes(token);
    expect(reclamos).toMatchObject({ tipo: 'servicio', client_id: 'ms-academico', scope: 'usuarios:crear', iss: 'aulaconecta-identidad' });
    expect(reclamos.aud).toContain('aulaconecta');
    expect(Number(reclamos.exp) - Number(reclamos.iat)).toBe(300);
    expect(reclamos).not.toHaveProperty('roles');

    // Así validarán ms-academico y ms-notificaciones los tokens: con la llave pública, sin llamar a ms-identidad
    const jwks = (await llamar('GET', '/.well-known/jwks.json')).json.keys as (JsonWebKey & { kid: string })[];
    const llave = jwks.find((k) => k.kid === cabecera.kid);
    expect(llave).toBeDefined();
    const [c, r, firma] = token.split('.');
    const valida = verify('sha256', Buffer.from(`${c}.${r}`), createPublicKey({ key: llave as JsonWebKey, format: 'jwk' }), Buffer.from(firma, 'base64url'));
    expect(valida).toBe(true);
  });

  it('el token de servicio no sirve para actuar como una persona ni como administrador', async () => {
    const token = (await tokenDeServicio()).json.accessToken as string;

    expect((await llamar('GET', '/auth/me', undefined, token)).estado).toBe(403);
    expect((await llamar('GET', '/auditoria-accesos', undefined, token)).estado).toBe(403);
    expect((await llamar('POST', `/usuarios/${docente.id}/desbloquear`, undefined, token)).estado).toBe(403);
  });

  it('rechaza un secreto equivocado, un cliente que no existe y otro tipo de grant', async () => {
    const malo = await tokenDeServicio('ms-academico', `${secreto()}x`);
    const inexistente = await tokenDeServicio('ms-inventado');

    for (const { estado, json } of [malo, inexistente]) {
      expect(estado).toBe(401);
      expect(json.codigo).toBe('CLIENTE_INVALIDO');
    }
    const password = await llamar('POST', '/oauth/token', { grantType: 'password', clientId: 'ms-academico', clientSecret: secreto() });
    expect(password.estado).toBe(400);
  });

  it('sin token o con un token inventado no se pueden crear cuentas', async () => {
    const cuerpo = { ...docente, id: randomUUID() };

    expect((await llamar('POST', '/usuarios', cuerpo)).estado).toBe(401);
    const sinFirma = `${[{ alg: 'none' }, { tipo: 'servicio', scope: 'usuarios:crear' }].map((p) => Buffer.from(JSON.stringify(p)).toString('base64url')).join('.')}.`;
    expect((await llamar('POST', '/usuarios', cuerpo, sinFirma)).estado).toBe(401);
  });
});
