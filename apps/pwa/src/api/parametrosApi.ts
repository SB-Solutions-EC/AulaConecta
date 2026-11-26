import { clienteHttp, type ClienteHttp } from './clienteHttp';

export interface ParametroColegio {
  id: string;
  clave: string;
  valor: Record<string, unknown>;
  version: number;
}

export interface SolicitudActualizarParametro {
  clave: string;
  valor: Record<string, unknown>;
  version: number;
}

const RUTA_PARAMETROS = '/api/academico/parametros';

export class ServicioParametrosApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarParametros(): Promise<ParametroColegio[]> {
    return this.cliente.get<ParametroColegio[]>(RUTA_PARAMETROS);
  }

  public actualizarParametro(
    solicitud: SolicitudActualizarParametro,
  ): Promise<ParametroColegio> {
    return this.cliente.put<ParametroColegio>(RUTA_PARAMETROS, solicitud);
  }
}

export const servicioParametrosApi = new ServicioParametrosApi();
