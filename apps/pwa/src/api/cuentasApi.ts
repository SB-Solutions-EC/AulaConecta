import { clienteHttp, type ClienteHttp } from './clienteHttp';

/**
 * Clave temporal de una cuenta (RF-03 v1.1, CR-02): aleatoria, de un solo uso y válida 72 horas.
 * Solo llega en la respuesta que la genera; la PWA la muestra una vez y no la guarda.
 */
export interface CredencialesTemporales {
  nombreUsuario: string;
  claveTemporal: string;
  claveTemporalVence?: string | null;
}

interface CuentaConClaveTemporal {
  nombreUsuario: string;
  claveTemporal?: string;
  claveTemporalVence?: string | null;
}

export class ServicioCuentasApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  /** Otra clave temporal para la cuenta (secretaría o administrador, RN-13). La anterior deja de servir. */
  public async generarClaveTemporal(usuarioId: string): Promise<CredencialesTemporales> {
    const cuenta = await this.cliente.post<CuentaConClaveTemporal>(
      `/api/identidad/usuarios/${encodeURIComponent(usuarioId)}/clave-temporal`,
    );
    if (!cuenta.claveTemporal) {
      throw new Error('ms-identidad no devolvió la clave temporal.');
    }
    return {
      nombreUsuario: cuenta.nombreUsuario,
      claveTemporal: cuenta.claveTemporal,
      claveTemporalVence: cuenta.claveTemporalVence ?? null,
    };
  }
}

export const servicioCuentasApi = new ServicioCuentasApi();
