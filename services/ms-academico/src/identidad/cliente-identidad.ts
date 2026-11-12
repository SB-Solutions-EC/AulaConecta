import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { ExcepcionApi } from '../comun/excepcion-api';
import { ConfiguracionIdentidad } from '../config/configuracion';

export type RolCuenta = 'ADMIN' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE';

/** Cuerpo de POST /usuarios en openapi/ms-identidad.yaml (SolicitudCrearUsuario). */
export interface SolicitudCrearCuenta {
  /** El mismo UUID de la PERSONA en ms-academico, para enlazar ambas sin llave foránea. */
  id?: string;
  nombres: string;
  apellidos: string;
  cedulaInicial: string;
  roles: RolCuenta[];
}

/** Respuesta de ms-identidad (UsuarioIdentidad): sin nombres ni cédula. */
export interface CuentaIdentidad {
  id: string;
  nombreUsuario: string;
  roles: RolCuenta[];
  estado: string;
  debeCambiarClave: boolean;
}

interface TokenVigente {
  valor: string;
  venceEn: number;
}

// Se renueva un poco antes de que venza, para que no expire mientras viaja
const MARGEN_RENOVACION_MS = 30_000;
const CODIGO_LEGIBLE = /^[A-Z_]{1,60}$/;

const noDisponible = (): ExcepcionApi =>
  new ExcepcionApi(503, 'IDENTIDAD_NO_DISPONIBLE', 'No se pudo crear la cuenta en este momento; intenta más tarde.');

/**
 * Llamadas de ms-academico a ms-identidad con un token de servicio (client credentials, T1110-A).
 * El secreto, el token y la cédula nunca se escriben en el registro.
 */
@Injectable()
export class ClienteIdentidad {
  private readonly registro = new Logger('ClienteIdentidad');
  private readonly config: ConfiguracionIdentidad;
  private token?: TokenVigente;
  private pidiendo?: Promise<TokenVigente>;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<ConfiguracionIdentidad>('identidad');
  }

  /** Crea la cuenta de una persona (RF-02, RF-03): ms-identidad genera el usuario y la clave inicial es la cédula. */
  async crearCuenta(solicitud: SolicitudCrearCuenta): Promise<CuentaIdentidad> {
    const respuesta = await this.enviarConToken('/usuarios', solicitud);
    if (respuesta.status === 201) {
      return (await respuesta.json()) as CuentaIdentidad;
    }
    throw await this.traducirError(respuesta);
  }

  private async enviarConToken(ruta: string, cuerpo: object): Promise<Response> {
    const respuesta = await this.enviar(ruta, cuerpo, (await this.tokenVigente()).valor);
    if (respuesta.status !== 401) {
      return respuesta;
    }
    // El token pudo dejar de valer antes de vencer (por ejemplo, si rotó la llave): se pide otro una sola vez
    this.token = undefined;
    return this.enviar(ruta, cuerpo, (await this.tokenVigente()).valor);
  }

  private async tokenVigente(): Promise<TokenVigente> {
    if (this.token && this.token.venceEn - MARGEN_RENOVACION_MS > Date.now()) {
      return this.token;
    }
    // Las peticiones simultáneas comparten una sola solicitud de token
    this.pidiendo ??= this.pedirToken().finally(() => {
      this.pidiendo = undefined;
    });
    this.token = await this.pidiendo;
    return this.token;
  }

  private async pedirToken(): Promise<TokenVigente> {
    const respuesta = await this.enviar('/oauth/token', {
      grantType: 'client_credentials',
      clientId: this.config.clienteId,
      clientSecret: await this.leerSecreto(),
    });
    if (respuesta.status !== 200) {
      this.registro.error(`ms-identidad no entregó el token de servicio de ${this.config.clienteId} (HTTP ${respuesta.status})`);
      throw noDisponible();
    }
    const { accessToken, expiresIn } = (await this.leerJson(respuesta)) as { accessToken?: unknown; expiresIn?: unknown };
    if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') {
      this.registro.error('ms-identidad respondió un token de servicio sin el formato del contrato');
      throw noDisponible();
    }
    return { valor: accessToken, venceEn: Date.now() + expiresIn * 1000 };
  }

  // Se lee en cada renovación: si el secreto rota, no hace falta reiniciar el servicio
  private async leerSecreto(): Promise<string> {
    const archivo = this.config.secretoArchivo;
    if (!archivo) {
      this.registro.error('Falta AULACONECTA_CLIENTE_SECRETO_ARCHIVO: no se pueden pedir tokens de servicio');
      throw noDisponible();
    }
    let secreto: string;
    try {
      secreto = (await readFile(archivo, 'utf8')).trim();
    } catch {
      this.registro.error('No se pudo leer el archivo del secreto de servicio');
      throw noDisponible();
    }
    if (!secreto) {
      this.registro.error('El archivo del secreto de servicio está vacío');
      throw noDisponible();
    }
    return secreto;
  }

  private async enviar(ruta: string, cuerpo: object, token?: string): Promise<Response> {
    const cabeceras: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) {
      cabeceras.Authorization = `Bearer ${token}`;
    }
    try {
      return await fetch(`${this.config.url}${ruta}`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.tiempoMaximoMs),
      });
    } catch (error) {
      const tipo = error instanceof Error ? error.name : 'desconocido';
      this.registro.error(`No se pudo conectar con ms-identidad en ${ruta} (${tipo})`);
      throw noDisponible();
    }
  }

  private async leerJson(respuesta: Response): Promise<Record<string, unknown>> {
    try {
      const cuerpo: unknown = await respuesta.json();
      return typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  /**
   * 400 y 409 se deben a los datos que envió la persona (nombre sin letras, cuenta repetida): se devuelven
   * con el código de ms-identidad. Lo demás es un problema entre servicios y queda solo en el registro.
   */
  private async traducirError(respuesta: Response): Promise<ExcepcionApi> {
    if (respuesta.status === 400 || respuesta.status === 409) {
      const { codigo, mensaje, detalles } = await this.leerJson(respuesta);
      const codigoValido = typeof codigo === 'string' && CODIGO_LEGIBLE.test(codigo);
      return new ExcepcionApi(
        respuesta.status,
        codigoValido ? codigo : 'DATOS_INVALIDOS',
        typeof mensaje === 'string' && codigoValido ? mensaje.slice(0, 300) : 'Los datos enviados no son válidos.',
        Array.isArray(detalles) ? detalles.filter((d): d is string => typeof d === 'string').slice(0, 20) : undefined,
      );
    }
    this.registro.error(`ms-identidad rechazó la llamada de servicio (HTTP ${respuesta.status})`);
    return noDisponible();
  }
}
