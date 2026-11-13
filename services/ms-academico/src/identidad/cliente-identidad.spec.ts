import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExcepcionApi } from '../comun/excepcion-api';
import { ConfiguracionIdentidad } from '../config/configuracion';
import { ClienteIdentidad, SolicitudCrearCuenta } from './cliente-identidad';

// ms-identidad simulado: cada prueba decide qué responde y revisa lo que recibió
interface Recibida {
  ruta: string;
  autorizacion?: string;
  cuerpo: Record<string, unknown>;
}
interface Respuesta {
  estado: number;
  cuerpo?: unknown;
  demoraMs?: number;
}

// Como el real: 32 bytes al azar en base64url, generado en cada ejecución
const SECRETO = randomBytes(32).toString('base64url');
// Provincia 99: no existe, no puede ser la cédula de una persona real
const SOLICITUD: SolicitudCrearCuenta = {
  id: '6f1c2e8a-3b4d-4c5e-8f9a-0b1c2d3e4f5a',
  nombres: 'Lucía',
  apellidos: 'Prueba Servicio',
  cedulaInicial: '9900000001',
  roles: ['DOCENTE'],
};
const CUENTA = { id: SOLICITUD.id, nombreUsuario: 'lucia.prueba', roles: ['DOCENTE'], estado: 'ACTIVO', debeCambiarClave: true };

let servidor: Server;
let url: string;
let recibidas: Recibida[];
let tokensEmitidos: number;
let responderToken: (recibida: Recibida) => Respuesta;
let responderUsuarios: (recibida: Recibida) => Respuesta;
let directorio: string;
let archivoSecreto: string;

const tokenNormal = (): Respuesta => ({ estado: 200, cuerpo: { accessToken: `token-${++tokensEmitidos}`, tokenType: 'Bearer', expiresIn: 300, scope: 'usuarios:crear' } });

function atender(peticion: IncomingMessage, respuesta: ServerResponse): void {
  let datos = '';
  peticion.on('data', (parte: Buffer) => (datos += parte.toString()));
  peticion.on('end', () => {
    const recibida: Recibida = { ruta: peticion.url ?? '', autorizacion: peticion.headers.authorization, cuerpo: JSON.parse(datos || '{}') };
    recibidas.push(recibida);
    const { estado, cuerpo, demoraMs } = (recibida.ruta === '/oauth/token' ? responderToken : responderUsuarios)(recibida);
    setTimeout(() => {
      respuesta.writeHead(estado, { 'Content-Type': 'application/json' });
      respuesta.end(cuerpo === undefined ? '' : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
    }, demoraMs ?? 0);
  });
}

function crearCliente(cambios: Partial<ConfiguracionIdentidad> = {}): ClienteIdentidad {
  const config: ConfiguracionIdentidad = { url, clienteId: 'ms-academico', secretoArchivo: archivoSecreto, tiempoMaximoMs: 1000, ...cambios };
  return new ClienteIdentidad({ getOrThrow: () => config } as unknown as ConfigService);
}

async function error(promesa: Promise<unknown>): Promise<ExcepcionApi> {
  const capturado: unknown = await promesa.then(() => undefined, (e: unknown) => e);
  expect(capturado).toBeInstanceOf(ExcepcionApi);
  return capturado as ExcepcionApi;
}

const rutas = (): string[] => recibidas.map((r) => r.ruta);

beforeAll(async () => {
  servidor = createServer(atender);
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  directorio = mkdtempSync(join(tmpdir(), 'secreto-'));
  archivoSecreto = join(directorio, 'secreto');
});

afterAll(async () => {
  await new Promise((listo) => servidor.close(listo));
  rmSync(directorio, { recursive: true, force: true });
});

beforeEach(() => {
  recibidas = [];
  tokensEmitidos = 0;
  responderToken = tokenNormal;
  responderUsuarios = () => ({ estado: 201, cuerpo: CUENTA });
  // Como lo deja generar_secretos_servicio.sh, pero con salto de línea final para probar que se recorta
  writeFileSync(archivoSecreto, `${SECRETO}\n`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClienteIdentidad', () => {
  it('pide el token con client credentials y crea la cuenta con él', async () => {
    const cuenta = await crearCliente().crearCuenta(SOLICITUD);

    expect(cuenta).toEqual(CUENTA);
    expect(recibidas[0]).toEqual({
      ruta: '/oauth/token',
      autorizacion: undefined,
      cuerpo: { grantType: 'client_credentials', clientId: 'ms-academico', clientSecret: SECRETO },
    });
    expect(recibidas[1]).toEqual({ ruta: '/usuarios', autorizacion: 'Bearer token-1', cuerpo: SOLICITUD });
  });

  it('reutiliza el token mientras esté vigente', async () => {
    const cliente = crearCliente();
    await cliente.crearCuenta(SOLICITUD);
    await cliente.crearCuenta(SOLICITUD);

    expect(rutas()).toEqual(['/oauth/token', '/usuarios', '/usuarios']);
  });

  it('lo renueva cuando le quedan menos de 30 segundos', async () => {
    responderToken = () => ({ estado: 200, cuerpo: { accessToken: `token-${++tokensEmitidos}`, expiresIn: 20 } });
    const cliente = crearCliente();
    await cliente.crearCuenta(SOLICITUD);
    await cliente.crearCuenta(SOLICITUD);

    expect(rutas()).toEqual(['/oauth/token', '/usuarios', '/oauth/token', '/usuarios']);
    expect(recibidas[3].autorizacion).toBe('Bearer token-2');
  });

  it('las peticiones simultáneas comparten una sola solicitud de token', async () => {
    responderToken = () => ({ ...tokenNormal(), demoraMs: 50 });
    const cliente = crearCliente();

    await Promise.all([1, 2, 3, 4, 5].map(() => cliente.crearCuenta(SOLICITUD)));

    expect(rutas().filter((ruta) => ruta === '/oauth/token')).toHaveLength(1);
  });

  it('si ms-identidad rechaza el token, pide otro y reintenta una sola vez', async () => {
    responderUsuarios = (r) => (r.autorizacion === 'Bearer token-1' ? { estado: 401 } : { estado: 201, cuerpo: CUENTA });

    await crearCliente().crearCuenta(SOLICITUD);

    expect(rutas()).toEqual(['/oauth/token', '/usuarios', '/oauth/token', '/usuarios']);
  });

  it('si vuelve a rechazarlo, responde 503 sin insistir más', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    responderUsuarios = () => ({ estado: 401 });

    const e = await error(crearCliente().crearCuenta(SOLICITUD));

    expect(e.getStatus()).toBe(503);
    expect(e.codigo).toBe('IDENTIDAD_NO_DISPONIBLE');
    expect(rutas()).toHaveLength(4);
  });

  it('lee el secreto en cada renovación: rotarlo no exige reiniciar', async () => {
    responderToken = () => ({ estado: 200, cuerpo: { accessToken: 'corto', expiresIn: 1 } });
    const cliente = crearCliente();
    await cliente.crearCuenta(SOLICITUD);
    writeFileSync(archivoSecreto, 'secreto-rotado');
    await cliente.crearCuenta(SOLICITUD);

    expect(recibidas[2].cuerpo.clientSecret).toBe('secreto-rotado');
  });

  it.each([
    [409, { codigo: 'USUARIO_EXISTENTE', mensaje: 'Ya existe una cuenta con ese identificador' }],
    [400, { codigo: 'NOMBRE_INVALIDO', mensaje: 'Los nombres deben tener al menos una letra', detalles: ['nombres: x'] }],
  ])('un %i de ms-identidad se debe a los datos y se devuelve con su código', async (estado, cuerpo) => {
    responderUsuarios = () => ({ estado, cuerpo });

    const e = await error(crearCliente().crearCuenta(SOLICITUD));

    expect(e.getStatus()).toBe(estado);
    expect(e.codigo).toBe(cuerpo.codigo);
    expect(e.message).toBe(cuerpo.mensaje);
    expect(e.detalles).toEqual('detalles' in cuerpo ? cuerpo.detalles : undefined);
  });

  it('no reenvía un código o un cuerpo de error con forma extraña', async () => {
    responderUsuarios = () => ({ estado: 400, cuerpo: { codigo: '<script>alert(1)</script>', mensaje: 'detalle interno' } });
    const raro = await error(crearCliente().crearCuenta(SOLICITUD));
    expect([raro.codigo, raro.message]).toEqual(['DATOS_INVALIDOS', 'Los datos enviados no son válidos.']);

    responderUsuarios = () => ({ estado: 409, cuerpo: 'no es json' });
    expect((await error(crearCliente().crearCuenta(SOLICITUD))).codigo).toBe('DATOS_INVALIDOS');
  });

  it.each([
    ['ms-identidad falla', () => ({ estado: 500, cuerpo: { codigo: 'ERROR_INTERNO' } })],
    ['falta el alcance usuarios:crear', () => ({ estado: 403 })],
  ])('si %s responde 503', async (_caso, respuesta) => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    responderUsuarios = respuesta;

    expect((await error(crearCliente().crearCuenta(SOLICITUD))).getStatus()).toBe(503);
  });

  it('si rechaza las credenciales responde 503 y el registro no muestra el secreto ni la cédula', async () => {
    const registro = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    responderToken = () => ({ estado: 401, cuerpo: { codigo: 'CLIENTE_INVALIDO' } });

    const e = await error(crearCliente().crearCuenta(SOLICITUD));

    expect(e.codigo).toBe('IDENTIDAD_NO_DISPONIBLE');
    expect(rutas()).toEqual(['/oauth/token']);
    const escrito = JSON.stringify(registro.mock.calls);
    expect(escrito).toContain('HTTP 401');
    expect(escrito).not.toContain(SECRETO);
    expect(escrito).not.toContain(SOLICITUD.cedulaInicial);
  });

  it.each([
    ['sin accessToken', { expiresIn: 300 }],
    ['expiresIn de texto', { accessToken: 'x', expiresIn: '300' }],
    ['que no es JSON', 'hola'],
  ])('un token %s no se usa', async (_caso, cuerpo) => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    responderToken = () => ({ estado: 200, cuerpo });

    expect((await error(crearCliente().crearCuenta(SOLICITUD))).getStatus()).toBe(503);
  });

  it.each([
    ['sin archivo configurado', { secretoArchivo: undefined }],
    ['con un archivo que no existe', { secretoArchivo: join(tmpdir(), 'no-existe', 'secreto') }],
  ])('%s no llama a ms-identidad y responde 503', async (_caso, cambios) => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect((await error(crearCliente(cambios).crearCuenta(SOLICITUD))).getStatus()).toBe(503);
    expect(recibidas).toHaveLength(0);
  });

  it('un archivo de secreto vacío tampoco sirve', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    writeFileSync(archivoSecreto, '  \n');

    expect((await error(crearCliente().crearCuenta(SOLICITUD))).getStatus()).toBe(503);
    expect(recibidas).toHaveLength(0);
  });

  it('si ms-identidad no responde a tiempo, corta la llamada y responde 503', async () => {
    const registro = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    responderUsuarios = () => ({ estado: 201, cuerpo: CUENTA, demoraMs: 500 });

    const e = await error(crearCliente({ tiempoMaximoMs: 100 }).crearCuenta(SOLICITUD));

    expect(e.getStatus()).toBe(503);
    expect(JSON.stringify(registro.mock.calls)).toContain('TimeoutError');
  });

  it('si ms-identidad está caído responde 503', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const cerrado = createServer();
    await new Promise<void>((listo) => cerrado.listen(0, '127.0.0.1', listo));
    const puerto = (cerrado.address() as AddressInfo).port;
    await new Promise((listo) => cerrado.close(listo));

    expect((await error(crearCliente({ url: `http://127.0.0.1:${puerto}` }).crearCuenta(SOLICITUD))).getStatus()).toBe(503);
  });
});
