import { clienteHttp, type ClienteHttp } from './clienteHttp';

export type TipoActividadAcademica = 'TAREA' | 'PRUEBA' | 'PROYECTO';
export type EstadoEntregaTarea = 'PENDIENTE' | 'ENTREGADA' | 'CALIFICADA';

export interface TareaAcademica {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoActividadAcademica;
  cursoId: string;
  materiaId: string;
  periodoId: string;
  fechaEntrega: string;
  puntajeMaximo: number;
  creadoPor: string;
  version: number;
}

export interface EntregaTarea {
  id: string;
  tareaId: string;
  estudianteId: string;
  nombreEstudiante: string;
  comentario: string;
  enlaceAdjunto?: string;
  estado: EstadoEntregaTarea;
  calificacion: number | null;
  observacionDocente?: string;
  fechaEntregaReal?: string;
  version: number;
}

export interface FiltroTareas {
  cursoId?: string;
  materiaId?: string;
  tipo?: TipoActividadAcademica;
}

export interface SolicitudCrearTarea {
  titulo: string;
  descripcion: string;
  tipo: TipoActividadAcademica;
  cursoId: string;
  materiaId: string;
  periodoId: string;
  fechaEntrega: string;
  puntajeMaximo: number;
}

export interface SolicitudEnviarEntrega {
  tareaId: string;
  estudianteId?: string;
  nombreEstudiante?: string;
  comentario: string;
  enlaceAdjunto?: string;
}

export interface SolicitudCalificarEntrega {
  calificacion: number;
  observacionDocente?: string;
}

const RUTA_TAREAS = '/api/academico/tareas';
const RUTA_ENTREGAS = '/api/academico/entregas';

export class ServicioTareasApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarTareas(filtro?: FiltroTareas): Promise<TareaAcademica[]> {
    const params = new URLSearchParams();
    if (filtro?.cursoId) {
      params.set('cursoId', filtro.cursoId);
    }
    if (filtro?.materiaId) {
      params.set('materiaId', filtro.materiaId);
    }
    if (filtro?.tipo) {
      params.set('tipo', filtro.tipo);
    }
    const query = params.toString();
    return this.cliente.get<TareaAcademica[]>(
      query ? `${RUTA_TAREAS}?${query}` : RUTA_TAREAS,
    );
  }

  public crearTarea(solicitud: SolicitudCrearTarea): Promise<TareaAcademica> {
    return this.cliente.post<TareaAcademica>(RUTA_TAREAS, {
      ...solicitud,
      titulo: solicitud.titulo.trim(),
      descripcion: solicitud.descripcion.trim(),
    });
  }

  public listarEntregas(tareaId: string): Promise<EntregaTarea[]> {
    return this.cliente.get<EntregaTarea[]>(
      `${RUTA_TAREAS}/${encodeURIComponent(tareaId)}/entregas`,
    );
  }

  public enviarEntrega(solicitud: SolicitudEnviarEntrega): Promise<EntregaTarea> {
    return this.cliente.post<EntregaTarea>(
      `${RUTA_TAREAS}/${encodeURIComponent(solicitud.tareaId)}/entregas`,
      {
        estudianteId: solicitud.estudianteId,
        nombreEstudiante: solicitud.nombreEstudiante,
        comentario: solicitud.comentario.trim(),
        enlaceAdjunto: solicitud.enlaceAdjunto?.trim() || undefined,
      },
    );
  }

  public calificarEntrega(
    entregaId: string,
    solicitud: SolicitudCalificarEntrega,
  ): Promise<EntregaTarea> {
    return this.cliente.patch<EntregaTarea>(
      `${RUTA_ENTREGAS}/${encodeURIComponent(entregaId)}/calificar`,
      {
        calificacion: solicitud.calificacion,
        observacionDocente: solicitud.observacionDocente?.trim() || undefined,
      },
    );
  }
}

export const servicioTareasApi = new ServicioTareasApi();
