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

export interface DiaNoDictado {
  id: string;
  anioLectivoId: string;
  fecha: string;
  motivo: string;
  version: number;
}

export interface SolicitudDiaNoDictado {
  id?: string;
  fecha: string;
  motivo: string;
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
  nombre: string;
  area: string;
  version: number;
}

export interface SolicitudMateria {
  id?: string;
  nombre: string;
  area: string;
}

const RUTA_ANIOS_LECTIVOS = '/api/academico/anios-lectivos';
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

  public listarDiasNoDictados(anioLectivoId: string): Promise<DiaNoDictado[]> {
    return this.cliente.get<DiaNoDictado[]>(
      `${RUTA_ANIOS_LECTIVOS}/${encodeURIComponent(anioLectivoId)}/dias-no-dictados`,
    );
  }

  public crearDiaNoDictado(
    anioLectivoId: string,
    solicitud: SolicitudDiaNoDictado,
  ): Promise<DiaNoDictado> {
    return this.cliente.post<DiaNoDictado>(
      `${RUTA_ANIOS_LECTIVOS}/${encodeURIComponent(anioLectivoId)}/dias-no-dictados`,
      {
        ...solicitud,
        motivo: solicitud.motivo.trim(),
      },
    );
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
    return this.cliente.post<Materia>(RUTA_MATERIAS, {
      ...solicitud,
      nombre: solicitud.nombre.trim(),
      area: solicitud.area.trim(),
    });
  }
}

export const servicioAcademicoConfigApi = new ServicioAcademicoConfigApi();
