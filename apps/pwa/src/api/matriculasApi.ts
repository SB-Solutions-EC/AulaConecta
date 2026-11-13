import { clienteHttp, type ClienteHttp } from './clienteHttp';

export type TipoPersonaMatricula = 'ESTUDIANTE' | 'REPRESENTANTE';
export type EstadoMatricula = 'ACTIVA' | 'RETIRADA';

export interface PersonaAcademica {
  id: string;
  usuarioId: string;
  tipo: TipoPersonaMatricula | 'DOCENTE';
  nombres: string;
  apellidos: string;
  area?: string | null;
  version: number;
}

export interface SolicitudPersonaAcademica {
  id?: string;
  tipo: TipoPersonaMatricula;
  nombres: string;
  apellidos: string;
  cedula: string;
}

export interface Representacion {
  id: string;
  estudianteId: string;
  representanteId: string;
  parentesco: string;
  version: number;
}

export interface SolicitudRepresentacion {
  id?: string;
  estudianteId: string;
  representanteId: string;
  parentesco: string;
}

export interface Matricula {
  id: string;
  estudianteId: string;
  cursoId: string;
  estado: EstadoMatricula;
  version: number;
}

export interface SolicitudMatricula {
  id?: string;
  estudianteId: string;
  cursoId: string;
}

export interface ContactoNotificacion {
  id: string;
  representanteId: string;
  estudianteId: string;
  whatsapp: string;
  autorizaAvisos: boolean;
  fechaAutorizacion?: string | null;
  fechaBaja?: string | null;
  version: number;
}

export interface SolicitudContactoNotificacion {
  id?: string;
  representanteId: string;
  estudianteId: string;
  whatsapp: string;
  autorizaAvisos: boolean;
}

export interface SolicitudConsentimiento {
  autorizaAvisos: boolean;
  version: number;
}

export interface FiltroMatriculas {
  cursoId?: string;
  estudianteId?: string;
}

export interface FiltroContactos {
  representanteId?: string;
  estudianteId?: string;
}

export class ServicioMatriculasApi {
  private readonly http: ClienteHttp;

  constructor(http: ClienteHttp = clienteHttp) {
    this.http = http;
  }

  async listarEstudiantes(busqueda?: string): Promise<PersonaAcademica[]> {
    return this.listarPersonasPorTipo('ESTUDIANTE', busqueda);
  }

  async listarRepresentantes(busqueda?: string): Promise<PersonaAcademica[]> {
    return this.listarPersonasPorTipo('REPRESENTANTE', busqueda);
  }

  private async listarPersonasPorTipo(
    tipo: TipoPersonaMatricula,
    busqueda?: string,
  ): Promise<PersonaAcademica[]> {
    const params = new URLSearchParams({ tipo });
    const texto = busqueda?.trim();
    if (texto) {
      params.set('q', texto);
    }
    return this.http.get<PersonaAcademica[]>(
      `/api/academico/personas?${params.toString()}`,
    );
  }

  async crearPersona(
    solicitud: SolicitudPersonaAcademica,
  ): Promise<PersonaAcademica> {
    return this.http.post<PersonaAcademica>('/api/academico/personas', solicitud);
  }

  async crearRepresentacion(
    solicitud: SolicitudRepresentacion,
  ): Promise<Representacion> {
    return this.http.post<Representacion>(
      '/api/academico/representaciones',
      solicitud,
    );
  }

  async listarMatriculas(filtro?: FiltroMatriculas): Promise<Matricula[]> {
    const params = new URLSearchParams();
    if (filtro?.cursoId) {
      params.set('cursoId', filtro.cursoId);
    }
    if (filtro?.estudianteId) {
      params.set('estudianteId', filtro.estudianteId);
    }
    const query = params.toString();
    const ruta = query
      ? `/api/academico/matriculas?${query}`
      : '/api/academico/matriculas';
    return this.http.get<Matricula[]>(ruta);
  }

  async crearMatricula(solicitud: SolicitudMatricula): Promise<Matricula> {
    return this.http.post<Matricula>('/api/academico/matriculas', solicitud);
  }

  async listarContactos(
    filtro?: FiltroContactos,
  ): Promise<ContactoNotificacion[]> {
    const params = new URLSearchParams();
    if (filtro?.representanteId) {
      params.set('representanteId', filtro.representanteId);
    }
    if (filtro?.estudianteId) {
      params.set('estudianteId', filtro.estudianteId);
    }
    const query = params.toString();
    const ruta = query
      ? `/api/notificaciones/contactos?${query}`
      : '/api/notificaciones/contactos';
    return this.http.get<ContactoNotificacion[]>(ruta);
  }

  async crearContacto(
    solicitud: SolicitudContactoNotificacion,
  ): Promise<ContactoNotificacion> {
    return this.http.post<ContactoNotificacion>(
      '/api/notificaciones/contactos',
      solicitud,
    );
  }

  async actualizarConsentimiento(
    contactoId: string,
    solicitud: SolicitudConsentimiento,
  ): Promise<ContactoNotificacion> {
    return this.http.patch<ContactoNotificacion>(
      `/api/notificaciones/contactos/${encodeURIComponent(contactoId)}/consentimiento`,
      solicitud,
    );
  }
}

export const servicioMatriculasApi = new ServicioMatriculasApi();
