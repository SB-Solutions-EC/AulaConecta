import {
  clienteHttp,
  type ClienteHttp,
  type CodigoRol,
  type RespuestaTokenAcceso,
  type UsuarioIdentidad,
} from './clienteHttp';

export interface SolicitudLogin {
  nombreUsuario: string;
  clave: string;
}

export interface SolicitudCambioClave {
  claveActual: string;
  claveNueva: string;
}

export type MotivoCierreSesion =
  | 'MANUAL'
  | 'INACTIVIDAD'
  | 'TOKEN_EXPIRADO'
  | null;

const RUTA_LOGIN = '/api/identidad/auth/login';
const RUTA_CAMBIAR_CLAVE = '/api/identidad/auth/cambiar-clave';
const RUTA_PERFIL_ME = '/api/identidad/auth/me';
const RUTA_LOGOUT = '/api/identidad/auth/logout';

export const TIEMPO_INACTIVIDAD_POR_DEFECTO_MS = 15 * 60 * 1000;

export function normalizarRolesAsignados(
  roles?: readonly CodigoRol[] | null,
): CodigoRol[] {
  if (!roles || roles.length === 0) {
    return ['ESTUDIANTE'];
  }
  const unicos = Array.from(new Set(roles));
  return unicos.length > 0 ? unicos : ['ESTUDIANTE'];
}

export function resolverRolActivo(
  rolesAsignados: readonly CodigoRol[],
  rolPreferido?: CodigoRol,
): CodigoRol {
  const normalizados = normalizarRolesAsignados(rolesAsignados);
  if (rolPreferido && normalizados.includes(rolPreferido)) {
    return rolPreferido;
  }
  return normalizados[0];
}

export class ServicioAutenticacionApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public async iniciarSesion(
    solicitud: SolicitudLogin,
  ): Promise<RespuestaTokenAcceso> {
    const respuesta = await this.cliente.post<RespuestaTokenAcceso>(
      RUTA_LOGIN,
      {
        nombreUsuario: solicitud.nombreUsuario.trim(),
        clave: solicitud.clave,
      },
      { omitirAutenticacion: true },
    );

    this.cliente.establecerTokenAcceso(respuesta.accessToken);
    return respuesta;
  }

  public async cambiarClaveInicial(
    solicitud: SolicitudCambioClave,
  ): Promise<RespuestaTokenAcceso> {
    const respuesta = await this.cliente.post<RespuestaTokenAcceso>(
      RUTA_CAMBIAR_CLAVE,
      {
        claveActual: solicitud.claveActual,
        claveNueva: solicitud.claveNueva,
      },
    );

    this.cliente.establecerTokenAcceso(respuesta.accessToken);
    return respuesta;
  }

  public obtenerPerfilActual(): Promise<UsuarioIdentidad> {
    return this.cliente.get<UsuarioIdentidad>(RUTA_PERFIL_ME);
  }

  public async cerrarSesion(): Promise<void> {
    try {
      await this.cliente.post<undefined>(RUTA_LOGOUT);
    } catch {
      // Incluso si el servidor no responde o la sesión ya expiró, se limpia el token en memoria
    } finally {
      this.cliente.limpiarTokenAcceso();
    }
  }
}

export const servicioAutenticacionApi = new ServicioAutenticacionApi();
