import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, KeyObject, verify } from 'node:crypto';
import { ExcepcionApi } from '../comun/excepcion-api';
import { ConfiguracionJwt } from '../config/configuracion';

// Verifica los tokens de acceso que emite ms-identidad (RS256 con kid) usando su JWKS público.
// ms-academico nunca guarda llaves: las descarga de /.well-known/jwks.json y las tiene en memoria.

/** Usuario autenticado tal como lo describe el token. */
export interface UsuarioToken {
  /** UUID de la cuenta en ms-identidad (persona.usuario_id). */
  id: string;
  roles: string[];
  debeCambiarClave: boolean;
}

const VIGENCIA_JWKS_MS = 10 * 60 * 1000; // se renueva cada 10 minutos
const ESPERA_RECARGA_MS = 30 * 1000; // ante un kid desconocido, como mucho una recarga cada 30 s
const TOLERANCIA_RELOJ_S = 30;
const FORMATO_BEARER = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/;

export const noAutorizado = (): ExcepcionApi => new ExcepcionApi(401, 'NO_AUTORIZADO', 'Inicia sesión para continuar.');

interface Jwk {
  kid?: unknown;
  kty?: unknown;
  use?: unknown;
  alg?: unknown;
}

function leerParte(parte: string): Record<string, unknown> {
  const valor: unknown = JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw noAutorizado();
  }
  return valor as Record<string, unknown>;
}

@Injectable()
export class VerificadorJwt {
  private readonly registro = new Logger(VerificadorJwt.name);
  private readonly configuracion: ConfiguracionJwt;
  private llaves = new Map<string, KeyObject>();
  private cargadoEn = 0;
  private ultimoIntento = 0;
  private cargaEnCurso?: Promise<void>;

  constructor(config: ConfigService) {
    this.configuracion = config.getOrThrow<ConfiguracionJwt>('jwt');
  }

  /** Valida la cabecera Authorization y devuelve el usuario; cualquier problema termina en 401. */
  async verificar(cabecera: string | undefined): Promise<UsuarioToken> {
    const partes = FORMATO_BEARER.exec(cabecera ?? '');
    if (!partes) {
      throw noAutorizado();
    }
    const [, encabezado, cuerpo, firma] = partes;
    let datosEncabezado: Record<string, unknown>;
    let reclamos: Record<string, unknown>;
    try {
      datosEncabezado = leerParte(encabezado);
      reclamos = leerParte(cuerpo);
    } catch {
      throw noAutorizado();
    }

    // El algoritmo lo fija el servidor, nunca el token (evita alg none y la confusión con HS256)
    if (datosEncabezado.alg !== 'RS256' || typeof datosEncabezado.kid !== 'string') {
      throw noAutorizado();
    }
    const llave = await this.llave(datosEncabezado.kid);
    const firmaValida = llave !== undefined && verify('sha256', Buffer.from(`${encabezado}.${cuerpo}`), llave, Buffer.from(firma, 'base64url'));
    if (!firmaValida) {
      throw noAutorizado();
    }
    return this.validarReclamos(reclamos);
  }

  private validarReclamos(reclamos: Record<string, unknown>): UsuarioToken {
    const ahora = Date.now() / 1000;
    const audiencias = Array.isArray(reclamos.aud) ? reclamos.aud : [reclamos.aud];
    const vigente = typeof reclamos.exp === 'number' && reclamos.exp + TOLERANCIA_RELOJ_S > ahora;
    const yaValido = reclamos.nbf === undefined || (typeof reclamos.nbf === 'number' && reclamos.nbf - TOLERANCIA_RELOJ_S <= ahora);
    // Los tokens de servicio (tipo = servicio) son para llamadas entre microservicios, no para la API de usuarios
    const deUsuario = reclamos.tipo === undefined || reclamos.tipo === 'usuario';
    const roles = reclamos.roles;
    const rolesValidos = Array.isArray(roles) && roles.every((rol) => typeof rol === 'string');

    if (
      reclamos.iss !== this.configuracion.emisor ||
      !audiencias.includes(this.configuracion.audiencia) ||
      !vigente ||
      !yaValido ||
      typeof reclamos.sub !== 'string' ||
      reclamos.sub === '' ||
      !deUsuario ||
      !rolesValidos
    ) {
      throw noAutorizado();
    }
    return { id: reclamos.sub, roles: roles as string[], debeCambiarClave: reclamos.debe_cambiar_clave !== false };
  }

  private async llave(kid: string): Promise<KeyObject | undefined> {
    const vencido = Date.now() - this.cargadoEn > VIGENCIA_JWKS_MS;
    // Un kid nuevo suele significar que ms-identidad rotó la llave: se recarga, pero con un límite
    const desconocido = !this.llaves.has(kid) && Date.now() - this.ultimoIntento > ESPERA_RECARGA_MS;
    if (vencido || desconocido) {
      await this.cargarJwks();
    }
    return this.llaves.get(kid);
  }

  private cargarJwks(): Promise<void> {
    // Las peticiones simultáneas comparten una sola descarga
    this.cargaEnCurso ??= this.descargar().finally(() => {
      this.cargaEnCurso = undefined;
    });
    return this.cargaEnCurso;
  }

  private async descargar(): Promise<void> {
    this.ultimoIntento = Date.now();
    try {
      const respuesta = await fetch(this.configuracion.jwksUrl, { signal: AbortSignal.timeout(5000) });
      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }
      const { keys } = (await respuesta.json()) as { keys?: Jwk[] };
      const nuevas = new Map<string, KeyObject>();
      for (const jwk of Array.isArray(keys) ? keys : []) {
        if (typeof jwk.kid === 'string' && jwk.kty === 'RSA' && (jwk.use === undefined || jwk.use === 'sig')) {
          nuevas.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
        }
      }
      this.llaves = nuevas;
      this.cargadoEn = Date.now();
    } catch (error) {
      // Se conservan las llaves anteriores: si ms-identidad cae un momento, los tokens vigentes siguen sirviendo
      this.registro.warn(`No se pudo descargar el JWKS de ms-identidad: ${(error as Error).message}`);
    }
  }
}
