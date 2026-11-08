export type CodigoRol =
  | 'ADMIN'
  | 'SECRETARIA'
  | 'DOCENTE'
  | 'ESTUDIANTE'
  | 'REPRESENTANTE';

export type EstadoUsuario = 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';

export interface UsuarioIdentidad {
  id: string;
  nombreUsuario: string;
  roles: CodigoRol[];
  debeCambiarClave: boolean;
  estado: EstadoUsuario;
  intentosFallidos: number;
  bloqueadoHasta?: string | null;
  ultimoAcceso?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  actualizadoPor?: string | null;
  version: number;
}

export interface RespuestaTokenAcceso {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  usuario: UsuarioIdentidad;
}

export interface CuerpoErrorApi {
  codigo: string;
  mensaje: string;
  detalles?: string[];
  timestamp?: string;
}

export class ErrorHttpApi extends Error {
  public readonly estado: number;
  public readonly codigo: string;
  public readonly detalles: string[];

  constructor(
    estado: number,
    codigo: string,
    mensaje: string,
    detalles: string[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorHttpApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export interface OpcionesPeticionHttp extends Omit<RequestInit, 'body'> {
  cuerpo?: unknown;
  omitirAutenticacion?: boolean;
  reintentadoTrasRefresh?: boolean;
}

type ManejadorEventoSesion = () => void;

const RUTA_REFRESH_DEFECTO = '/api/identidad/auth/refresh';

/**
 * Cliente HTTP de AulaConecta con almacenamiento del token JWT en memoria
 * (nunca en localStorage según RNF-04), adjunción automática de Authorization
 * Bearer, rotación transparente de sesión ante respuestas 401 y notificación
 * cuando la cuenta conserva la clave inicial (debeCambiarClave = true, RF-03).
 */
export class ClienteHttp {
  private tokenAcceso: string | null = null;
  private promesaRenovacion: Promise<string | null> | null = null;
  private readonly oyentesSesionExpirada = new Set<ManejadorEventoSesion>();
  private readonly oyentesCambioClaveObligatorio =
    new Set<ManejadorEventoSesion>();
  private readonly rutaRefresh: string;

  constructor(rutaRefresh: string = RUTA_REFRESH_DEFECTO) {
    this.rutaRefresh = rutaRefresh;
  }

  public establecerTokenAcceso(token: string | null): void {
    this.tokenAcceso = token && token.trim().length > 0 ? token.trim() : null;
  }

  public obtenerTokenAcceso(): string | null {
    return this.tokenAcceso;
  }

  public limpiarTokenAcceso(): void {
    this.tokenAcceso = null;
  }

  public alExpirarSesion(manejador: ManejadorEventoSesion): () => void {
    this.oyentesSesionExpirada.add(manejador);
    return () => {
      this.oyentesSesionExpirada.delete(manejador);
    };
  }

  public alRequerirCambioClave(manejador: ManejadorEventoSesion): () => void {
    this.oyentesCambioClaveObligatorio.add(manejador);
    return () => {
      this.oyentesCambioClaveObligatorio.delete(manejador);
    };
  }

  public async solicitar<T>(
    ruta: string,
    opciones: OpcionesPeticionHttp = {},
  ): Promise<T> {
    const {
      cuerpo,
      omitirAutenticacion = false,
      reintentadoTrasRefresh = false,
      headers,
      ...restoOpciones
    } = opciones;

    const cabeceras = new Headers(headers);
    if (!cabeceras.has('Accept')) {
      cabeceras.set('Accept', 'application/json');
    }

    let cuerpoSerializado: BodyInit | undefined;
    if (cuerpo !== undefined) {
      if (typeof cuerpo === 'string' || cuerpo instanceof FormData) {
        cuerpoSerializado = cuerpo;
      } else {
        if (!cabeceras.has('Content-Type')) {
          cabeceras.set('Content-Type', 'application/json');
        }
        cuerpoSerializado = JSON.stringify(cuerpo);
      }
    }

    if (!omitirAutenticacion && this.tokenAcceso) {
      cabeceras.set('Authorization', `Bearer ${this.tokenAcceso}`);
    }

    const respuesta = await fetch(ruta, {
      ...restoOpciones,
      headers: cabeceras,
      body: cuerpoSerializado,
      credentials: restoOpciones.credentials ?? 'include',
    });

    if (
      respuesta.status === 401 &&
      !omitirAutenticacion &&
      !reintentadoTrasRefresh &&
      ruta !== this.rutaRefresh
    ) {
      const nuevoToken = await this.intentarRenovarToken();
      if (nuevoToken) {
        return this.solicitar<T>(ruta, {
          ...opciones,
          reintentadoTrasRefresh: true,
        });
      }
      this.limpiarTokenAcceso();
      this.notificarSesionExpirada();
    }

    if (!respuesta.ok) {
      const errorExtraido = await this.extraerErrorApi(respuesta);
      if (
        respuesta.status === 403 &&
        errorExtraido.codigo === 'CAMBIO_CLAVE_REQUERIDO'
      ) {
        this.notificarCambioClaveObligatorio();
      }
      throw errorExtraido;
    }

    if (respuesta.status === 204) {
      return undefined as T;
    }

    return (await respuesta.json()) as T;
  }

  public get<T>(
    ruta: string,
    opciones: Omit<OpcionesPeticionHttp, 'method' | 'cuerpo'> = {},
  ): Promise<T> {
    return this.solicitar<T>(ruta, { ...opciones, method: 'GET' });
  }

  public post<T>(
    ruta: string,
    cuerpo?: unknown,
    opciones: Omit<OpcionesPeticionHttp, 'method' | 'cuerpo'> = {},
  ): Promise<T> {
    return this.solicitar<T>(ruta, { ...opciones, method: 'POST', cuerpo });
  }

  public put<T>(
    ruta: string,
    cuerpo?: unknown,
    opciones: Omit<OpcionesPeticionHttp, 'method' | 'cuerpo'> = {},
  ): Promise<T> {
    return this.solicitar<T>(ruta, { ...opciones, method: 'PUT', cuerpo });
  }

  public patch<T>(
    ruta: string,
    cuerpo?: unknown,
    opciones: Omit<OpcionesPeticionHttp, 'method' | 'cuerpo'> = {},
  ): Promise<T> {
    return this.solicitar<T>(ruta, { ...opciones, method: 'PATCH', cuerpo });
  }

  private async intentarRenovarToken(): Promise<string | null> {
    if (this.promesaRenovacion) {
      return this.promesaRenovacion;
    }

    this.promesaRenovacion = this.ejecutarRenovacionToken().finally(() => {
      this.promesaRenovacion = null;
    });

    return this.promesaRenovacion;
  }

  private async ejecutarRenovacionToken(): Promise<string | null> {
    try {
      const respuesta = await fetch(this.rutaRefresh, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (!respuesta.ok) {
        return null;
      }

      const datos = (await respuesta.json()) as Partial<RespuestaTokenAcceso>;
      if (typeof datos.accessToken === 'string' && datos.accessToken.trim()) {
        this.establecerTokenAcceso(datos.accessToken);
        return this.tokenAcceso;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async extraerErrorApi(respuesta: Response): Promise<ErrorHttpApi> {
    try {
      const datos = (await respuesta.json()) as Partial<CuerpoErrorApi>;
      const codigo =
        typeof datos.codigo === 'string' && datos.codigo.trim()
          ? datos.codigo
          : `HTTP_${respuesta.status}`;
      const mensaje =
        typeof datos.mensaje === 'string' && datos.mensaje.trim()
          ? datos.mensaje
          : `Error HTTP ${respuesta.status}`;
      const detalles = Array.isArray(datos.detalles) ? datos.detalles : [];
      return new ErrorHttpApi(respuesta.status, codigo, mensaje, detalles);
    } catch {
      return new ErrorHttpApi(
        respuesta.status,
        `HTTP_${respuesta.status}`,
        `Error HTTP ${respuesta.status}`,
      );
    }
  }

  private notificarSesionExpirada(): void {
    for (const manejador of this.oyentesSesionExpirada) {
      manejador();
    }
  }

  private notificarCambioClaveObligatorio(): void {
    for (const manejador of this.oyentesCambioClaveObligatorio) {
      manejador();
    }
  }
}

export const clienteHttp = new ClienteHttp();

