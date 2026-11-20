import { clienteHttp, type ClienteHttp } from './clienteHttp';
import type { CredencialesTemporales } from './cuentasApi';

export type HoraBloque = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

export interface DocentePersona {
  id: string;
  usuarioId: string;
  tipo: 'DOCENTE';
  nombres: string;
  apellidos: string;
  area?: string | null;
  version: number;
}

/** Respuesta del alta: la clave temporal de la cuenta llega solo aquí (CR-02). */
export interface DocenteCreado extends DocentePersona {
  credenciales?: CredencialesTemporales;
}

export interface SolicitudCrearDocente {
  id?: string;
  tipo: 'DOCENTE';
  nombres: string;
  apellidos: string;
  cedula: string;
  area?: string | null;
}

export interface BloqueHorario {
  id?: string;
  dia: number;
  hora: HoraBloque;
  version?: number;
}

export interface AsignacionDocente {
  id: string;
  docenteId: string;
  materiaId: string;
  cursoId: string;
  horarios?: BloqueHorario[];
  version: number;
}

export interface SolicitudCrearAsignacion {
  id?: string;
  docenteId: string;
  materiaId: string;
  cursoId: string;
  horarios?: BloqueHorario[];
}

export interface FiltroAsignaciones {
  docenteId?: string;
  cursoId?: string;
}

export class ServicioDocentesApi {
  private readonly http: ClienteHttp;

  constructor(http: ClienteHttp = clienteHttp) {
    this.http = http;
  }

  async listarDocentes(busqueda?: string): Promise<DocentePersona[]> {
    const params = new URLSearchParams({ tipo: 'DOCENTE' });
    const texto = busqueda?.trim();
    if (texto) {
      params.set('q', texto);
    }
    return this.http.get<DocentePersona[]>(`/api/academico/personas?${params.toString()}`);
  }

  async crearDocente(solicitud: Omit<SolicitudCrearDocente, 'tipo'>): Promise<DocenteCreado> {
    return this.http.post<DocenteCreado>('/api/academico/personas', {
      ...solicitud,
      tipo: 'DOCENTE',
    });
  }

  async listarAsignaciones(filtro?: FiltroAsignaciones): Promise<AsignacionDocente[]> {
    const params = new URLSearchParams();
    if (filtro?.docenteId) {
      params.set('docenteId', filtro.docenteId);
    }
    if (filtro?.cursoId) {
      params.set('cursoId', filtro.cursoId);
    }
    const query = params.toString();
    const ruta = query ? `/api/academico/asignaciones?${query}` : '/api/academico/asignaciones';
    return this.http.get<AsignacionDocente[]>(ruta);
  }

  async crearAsignacion(solicitud: SolicitudCrearAsignacion): Promise<AsignacionDocente> {
    return this.http.post<AsignacionDocente>('/api/academico/asignaciones', solicitud);
  }
}

export const servicioDocentesApi = new ServicioDocentesApi();
