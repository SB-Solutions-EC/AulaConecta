import { clienteHttp, type ClienteHttp } from './clienteHttp';

export type EstadoAsistencia = 'PRESENTE' | 'FALTA' | 'ATRASO' | 'JUSTIFICADA';
export type EstadoJustificacion = 'SOLICITADA' | 'APROBADA' | null;

export interface RegistroAsistencia {
  id: string;
  asignacionId: string;
  matriculaId: string;
  estudianteId?: string;
  nombreEstudiante?: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion: string | null;
  estadoJustificacion: EstadoJustificacion;
  version: number;
}

export interface FiltroAsistencias {
  asignacionId?: string;
  matriculaId?: string;
  fecha?: string;
}

export interface SolicitudGuardarAsistencia {
  id?: string;
  asignacionId: string;
  matriculaId: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  confirmar?: boolean;
  version: number;
}

const RUTA_ASISTENCIAS = '/api/academico/asistencias';

export class ServicioAsistenciaApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarAsistencias(
    filtro?: FiltroAsistencias,
  ): Promise<RegistroAsistencia[]> {
    const params = new URLSearchParams();
    if (filtro?.asignacionId) {
      params.set('asignacionId', filtro.asignacionId);
    }
    if (filtro?.matriculaId) {
      params.set('matriculaId', filtro.matriculaId);
    }
    if (filtro?.fecha) {
      params.set('fecha', filtro.fecha);
    }
    const query = params.toString();
    return this.cliente.get<RegistroAsistencia[]>(
      query ? `${RUTA_ASISTENCIAS}?${query}` : RUTA_ASISTENCIAS,
    );
  }

  public guardarAsistencia(
    solicitud: SolicitudGuardarAsistencia,
  ): Promise<RegistroAsistencia> {
    const justificacionLimpia = solicitud.justificacion?.trim() || null;
    return this.cliente.put<RegistroAsistencia>(RUTA_ASISTENCIAS, {
      ...solicitud,
      justificacion: justificacionLimpia,
    });
  }

  public solicitarJustificacion(
    asistenciaId: string,
    motivo: string,
  ): Promise<RegistroAsistencia> {
    return this.cliente.post<RegistroAsistencia>(
      `${RUTA_ASISTENCIAS}/${encodeURIComponent(asistenciaId)}/justificacion`,
      { motivo: motivo.trim() },
    );
  }
}

export const servicioAsistenciaApi = new ServicioAsistenciaApi();
