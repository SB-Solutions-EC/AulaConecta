import { clienteHttp, type ClienteHttp } from './clienteHttp';

// Escalas, claves y cualitativos son los del paquete compartido: el mismo cálculo que usa ms-academico (RF-22)
import type {
  ClaveIndicadorComportamiento,
  CualitativoComportamiento,
  EscalaComportamiento,
  IndicadoresComportamiento,
} from '@aulaconecta/calculo-notas';

export type {
  ClaveIndicadorComportamiento,
  CualitativoComportamiento,
  EscalaComportamiento,
  IndicadoresComportamiento,
};

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
