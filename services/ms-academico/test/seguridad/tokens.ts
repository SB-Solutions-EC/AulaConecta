import { createHmac, generateKeyPairSync, KeyObject, randomUUID, sign } from 'node:crypto';

// Tokens como los emite ms-identidad (RS256, kid, iss, aud, roles, debe_cambiar_clave),
// firmados con una llave generada en cada ejecución: no hay llaves guardadas en el repositorio.
export const EMISOR = 'aulaconecta-identidad';
export const AUDIENCIA = 'aulaconecta';

function crearLlave(): { privada: KeyObject; publica: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privada: privateKey, publica: publicKey };
}

const llave = crearLlave();
const llaveAjena = crearLlave();
export const KID = 'llave-prueba-academico';
export const CLAVE_PUBLICA = llave.publica;
// JWKS que publicaría ms-identidad en /.well-known/jwks.json
export const JWKS = { keys: [{ ...llave.publica.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] };

const base64url = (datos: string | Buffer): string => Buffer.from(datos).toString('base64url');

export interface Reclamos {
  sub?: string;
  tipo?: string;
  iss?: string;
  aud?: string | string[];
  roles?: unknown;
  debe_cambiar_clave?: boolean;
  scope?: string;
  client_id?: string;
  iat?: number;
  exp?: number;
}

function reclamos(roles: string[], cambios: Reclamos = {}): Reclamos {
  const ahora = Math.floor(Date.now() / 1000);
  return {
    sub: randomUUID(),
    // Como ms-identidad desde T1110-A: separa los tokens de usuario de los de servicio
    tipo: 'usuario',
    iss: EMISOR,
    aud: [AUDIENCIA],
    roles,
    debe_cambiar_clave: false,
    iat: ahora,
    exp: ahora + 15 * 60,
    ...cambios,
  };
}

function firmarRs256(cuerpo: Reclamos, privada: KeyObject, kid: string): string {
  const datos = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))}.${base64url(JSON.stringify(cuerpo))}`;
  return `${datos}.${base64url(sign('sha256', Buffer.from(datos), privada))}`;
}

/** Token válido para los roles indicados. */
export function tokenValido(roles: string[], cambios: Reclamos = {}): string {
  return firmarRs256(reclamos(roles, cambios), llave.privada, KID);
}

export interface TokenMalicioso {
  nombre: string;
  /** Valor completo de la cabecera Authorization (undefined: no se envía). */
  cabecera: string | undefined;
}

/** Tokens que deben terminar en 401 sin importar el endpoint. */
export function tokensRechazados(): TokenMalicioso[] {
  const admin = reclamos(['ADMIN']);
  const docenteFirmado = tokenValido(['DOCENTE']);
  const [cabeceraDocente, , firmaDocente] = docenteFirmado.split('.');
  const encabezadoHs = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: KID }));
  const cuerpoAdmin = base64url(JSON.stringify(admin));
  const pem = llave.publica.export({ format: 'pem', type: 'spki' });
  const firmaHs = createHmac('sha256', pem).update(`${encabezadoHs}.${cuerpoAdmin}`).digest('base64url');
  const ahora = Math.floor(Date.now() / 1000);

  return [
    { nombre: 'sin cabecera Authorization', cabecera: undefined },
    { nombre: 'esquema Basic en lugar de Bearer', cabecera: `Basic ${base64url('usuario:clave')}` },
    { nombre: 'Bearer vacío', cabecera: 'Bearer ' },
    { nombre: 'texto que no es JWT', cabecera: 'Bearer esto-no-es-un-token' },
    { nombre: 'inyección SQL en el token', cabecera: "Bearer ' OR '1'='1" },
    {
      nombre: 'alg none sin firma',
      cabecera: `Bearer ${base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${cuerpoAdmin}.`,
    },
    { nombre: 'HS256 firmado con la llave pública (confusión de algoritmo)', cabecera: `Bearer ${encabezadoHs}.${cuerpoAdmin}.${firmaHs}` },
    { nombre: 'firmado con otra llave', cabecera: `Bearer ${firmarRs256(admin, llaveAjena.privada, KID)}` },
    { nombre: 'kid desconocido', cabecera: `Bearer ${firmarRs256(admin, llaveAjena.privada, 'otra-llave')}` },
    { nombre: 'rol cambiado a ADMIN conservando la firma', cabecera: `Bearer ${cabeceraDocente}.${cuerpoAdmin}.${firmaDocente}` },
    { nombre: 'vencido', cabecera: `Bearer ${tokenValido(['ADMIN'], { iat: ahora - 3600, exp: ahora - 60 })}` },
    { nombre: 'de otro emisor', cabecera: `Bearer ${tokenValido(['ADMIN'], { iss: 'emisor-falso' })}` },
    { nombre: 'para otra audiencia', cabecera: `Bearer ${tokenValido(['ADMIN'], { aud: ['otro-sistema'] })}` },
  ];
}

/** Token de servicio como el de T1110-A (tipo servicio, alcance, sin roles): no representa a una persona. */
export function tokenDeServicio(): string {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo: Reclamos = {
    sub: randomUUID(),
    tipo: 'servicio',
    client_id: 'ms-academico',
    scope: 'usuarios:crear',
    iss: EMISOR,
    aud: [AUDIENCIA],
    iat: ahora,
    exp: ahora + 300,
  };
  return firmarRs256(cuerpo, llave.privada, KID);
}
