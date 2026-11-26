import { clienteHttp, type ClienteHttp } from './clienteHttp';

export type EscalaComportamiento =
  | 'SIEMPRE'
  | 'FRECUENTEMENTE'
  | 'OCASIONALMENTE'
  | 'NUNCA';

export type ClaveIndicadorComportamiento =
  | 'cog1'
  | 'cog2'
  | 'cog3'
  | 'cog4'
  | 'soc1'
  | 'soc2'
  | 'soc3'
  | 'soc4'
  | 'soc5';

export type IndicadoresComportamiento = Partial<
  Record<ClaveIndicadorComportamiento, EscalaComportamiento>
>;

export type CualitativoComportamiento = 'A' | 'B' | 'C' | 'D' | 'E';

export interface RegistroComportamiento {
  id: string;
  matriculaId: string;
  estudianteId?: string;
  nombreEstudiante?: string;
  trimestre: 1 | 2 | 3;
  indicadores: IndicadoresComportamiento;
  nota: number;
  cualitativo: string;
  version: number;
}

export interface FiltroComportamientos {
  matriculaId?: string;
  trimestre?: 1 | 2 | 3;
}

export interface SolicitudGuardarComportamiento {
  id?: string;
  matriculaId: string;
  trimestre: 1 | 2 | 3;
  indicadores: Record<ClaveIndicadorComportamiento, EscalaComportamiento>;
  version: number;
}

const RUTA_COMPORTAMIENTOS = '/api/academico/comportamientos';

export class ServicioComportamientoApi {
  private readonly cliente: ClienteHttp;

  constructor(cliente: ClienteHttp = clienteHttp) {
    this.cliente = cliente;
  }

  public listarComportamientos(
    filtro?: FiltroComportamientos,
  ): Promise<RegistroComportamiento[]> {
    const params = new URLSearchParams();
    if (filtro?.matriculaId) {
      params.set('matriculaId', filtro.matriculaId);
    }
    if (filtro?.trimestre !== undefined) {
      params.set('trimestre', String(filtro.trimestre));
    }
    const query = params.toString();
    return this.cliente.get<RegistroComportamiento[]>(
      query ? `${RUTA_COMPORTAMIENTOS}?${query}` : RUTA_COMPORTAMIENTOS,
    );
  }

  public guardarComportamiento(
    solicitud: SolicitudGuardarComportamiento,
  ): Promise<RegistroComportamiento> {
    return this.cliente.put<RegistroComportamiento>(
      RUTA_COMPORTAMIENTOS,
      solicitud,
    );
  }
}

export const servicioComportamientoApi = new ServicioComportamientoApi();
