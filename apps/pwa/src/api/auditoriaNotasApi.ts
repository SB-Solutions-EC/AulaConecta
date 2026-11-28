import { clienteHttp, type ClienteHttp } from './clienteHttp';

export type AccionAuditoria = 'CREATE' | 'UPDATE' | 'DELETE_LOGICAL';

export interface RegistroAuditoriaAcademica {
  id: string;
  entidad: string;
  entidadId: string;
  accion: AccionAuditoria;
  valorAnterior: Record<string, unknown> | null;
  valorNuevo: Record<string, unknown> | null;
  usuarioId: string;
  nombreUsuario?: string;
  ocurridoEn: string;
}

const RUTA_AUDITORIA = '/api/academico/auditoria';

export class ServicioAuditoriaNotasApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarHistorialNota(
    calificacionId: string,
  ): Promise<RegistroAuditoriaAcademica[]> {
    const params = new URLSearchParams({
      entidad: 'CALIFICACION',
      entidadId: calificacionId,
    });
    return this.cliente.get<RegistroAuditoriaAcademica[]>(
      `${RUTA_AUDITORIA}?${params.toString()}`,
    );
  }

  public listarAuditoriaCalificaciones(): Promise<
    RegistroAuditoriaAcademica[]
  > {
    const params = new URLSearchParams({
      entidad: 'CALIFICACION',
    });
    return this.cliente.get<RegistroAuditoriaAcademica[]>(
      `${RUTA_AUDITORIA}?${params.toString()}`,
    );
  }
}

export const servicioAuditoriaNotasApi = new ServicioAuditoriaNotasApi();
