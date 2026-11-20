import { clienteHttp, type ClienteHttp } from './clienteHttp';

export interface AnioLectivo {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
  activo: boolean;
  version: number;
}

export interface SolicitudAnioLectivo {
  id?: string;
  nombre: string;
  inicio: string;
  fin: string;
  activo?: boolean;
}

/** Trimestre del año lectivo (RF-07). RF-08, días no dictados, queda fuera de la versión 1.0. */
export interface Periodo {
  id: string;
  anioLectivoId: string;
  numero: number;
  inicio: string;
  fin: string;
  cerrado: boolean;
  version: number;
}

export interface SolicitudPeriodo {
  id?: string;
  anioLectivoId: string;
  numero: number;
  inicio: string;
  fin: string;
}

export interface Curso {
  id: string;
  anioLectivoId: string;
  nivel: string;
  paralelo: string;
  version: number;
}

export interface SolicitudCurso {
  id?: string;
  anioLectivoId: string;
  nivel: string;
  paralelo: string;
}

export interface Materia {
  id: string;
  /** Código corto único, por ejemplo MAT (Taller 2, tabla materia). */
  codigo: string;
  nombre: string;
  area: string | null;
  version: number;
}

export interface SolicitudMateria {
  id?: string;
  codigo: string;
  nombre: string;
  area?: string;
}

const RUTA_ANIOS_LECTIVOS = '/api/academico/anios-lectivos';
const RUTA_PERIODOS = '/api/academico/periodos';
const RUTA_CURSOS = '/api/academico/cursos';
const RUTA_MATERIAS = '/api/academico/materias';

export class ServicioAcademicoConfigApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarAniosLectivos(): Promise<AnioLectivo[]> {
    return this.cliente.get<AnioLectivo[]>(RUTA_ANIOS_LECTIVOS);
  }

  public crearAnioLectivo(
    solicitud: SolicitudAnioLectivo,
  ): Promise<AnioLectivo> {
    return this.cliente.post<AnioLectivo>(RUTA_ANIOS_LECTIVOS, {
      ...solicitud,
      nombre: solicitud.nombre.trim(),
      activo: solicitud.activo ?? true,
    });
  }

  public listarPeriodos(anioLectivoId: string): Promise<Periodo[]> {
    return this.cliente.get<Periodo[]>(
      `${RUTA_PERIODOS}?anioLectivoId=${encodeURIComponent(anioLectivoId)}`,
    );
  }

  public crearPeriodo(solicitud: SolicitudPeriodo): Promise<Periodo> {
    return this.cliente.post<Periodo>(RUTA_PERIODOS, solicitud);
  }

  public listarCursos(anioLectivoId?: string): Promise<Curso[]> {
    const query = anioLectivoId
      ? `?anioLectivoId=${encodeURIComponent(anioLectivoId)}`
      : '';
    return this.cliente.get<Curso[]>(`${RUTA_CURSOS}${query}`);
  }

  public crearCurso(solicitud: SolicitudCurso): Promise<Curso> {
    return this.cliente.post<Curso>(RUTA_CURSOS, {
      ...solicitud,
      nivel: solicitud.nivel.trim(),
      paralelo: solicitud.paralelo.trim().toUpperCase(),
    });
  }

  public listarMaterias(): Promise<Materia[]> {
    return this.cliente.get<Materia[]>(RUTA_MATERIAS);
  }

  public crearMateria(solicitud: SolicitudMateria): Promise<Materia> {
    const area = solicitud.area?.trim();
    return this.cliente.post<Materia>(RUTA_MATERIAS, {
      ...solicitud,
      codigo: solicitud.codigo.trim().toUpperCase(),
      nombre: solicitud.nombre.trim(),
      // El área es opcional: vacía no se envía
      area: area || undefined,
    });
  }
}

export const servicioAcademicoConfigApi = new ServicioAcademicoConfigApi();
