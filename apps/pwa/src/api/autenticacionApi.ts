import {
  clienteHttp,
  type ClienteHttp,
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

const RUTA_LOGIN = '/api/identidad/auth/login';
const RUTA_CAMBIAR_CLAVE = '/api/identidad/auth/cambiar-clave';
const RUTA_PERFIL_ME = '/api/identidad/auth/me';

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
}

export const servicioAutenticacionApi = new ServicioAutenticacionApi();

