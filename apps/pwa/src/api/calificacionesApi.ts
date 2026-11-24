import { clienteHttp, type ClienteHttp } from './clienteHttp';

export interface RegistroCalificacion {
  id: string;
  matriculaId: string;
  estudianteId: string;
  nombreEstudiante: string;
  materiaId: string;
  periodoId: string;
  bloque1: Array<number | null>;
  bloque2: Array<number | null>;
  refuerzo: number | null;
  proyecto: number | null;
  examen: number | null;
  version: number;
  actualizadoEn?: string;
}

export interface SolicitudGuardarCalificacion {
  id?: string;
  matriculaId: string;
  materiaId: string;
  periodoId: string;
  bloque1: Array<number | null>;
  bloque2: Array<number | null>;
  refuerzo: number | null;
  proyecto: number | null;
  examen: number | null;
  version?: number;
}

export interface FiltroLibreta {
  cursoId: string;
  materiaId: string;
  periodoId: string;
}

const RUTA_CALIFICACIONES = '/api/academico/calificaciones';

export class ServicioCalificacionesApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarLibreta(filtro: FiltroLibreta): Promise<RegistroCalificacion[]> {
    const params = new URLSearchParams({
      cursoId: filtro.cursoId,
      materiaId: filtro.materiaId,
      periodoId: filtro.periodoId,
    });
    return this.cliente.get<RegistroCalificacion[]>(
      `${RUTA_CALIFICACIONES}?${params.toString()}`,
    );
  }

  public guardarCalificacion(
    solicitud: SolicitudGuardarCalificacion,
  ): Promise<RegistroCalificacion> {
    return this.cliente.put<RegistroCalificacion>(RUTA_CALIFICACIONES, solicitud);
  }

  public guardarLote(
    solicitudes: SolicitudGuardarCalificacion[],
  ): Promise<RegistroCalificacion[]> {
    return this.cliente.put<RegistroCalificacion[]>(
      `${RUTA_CALIFICACIONES}/lote`,
      { calificaciones: solicitudes },
    );
  }
}

export const servicioCalificacionesApi = new ServicioCalificacionesApi();
