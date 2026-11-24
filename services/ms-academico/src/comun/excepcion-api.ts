import { HttpException } from '@nestjs/common';

// Forma única de los errores, igual al esquema ErrorApi de openapi/ms-academico.yaml.
export interface ErrorApi {
  codigo: string;
  mensaje: string;
  detalles?: string[];
  timestamp: string;
}

// Error con código propio para que la PWA no dependa del texto del mensaje.
export class ExcepcionApi extends HttpException {
  constructor(
    estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: string[],
  ) {
    super(mensaje, estado);
  }
}

/** Cuerpo ConflictoSincronizacion de openapi/ms-academico.yaml (409 por versión). */
export interface ConflictoSincronizacion {
  status: 'CONFLICT';
  entityId: string;
  baseVersion: number;
  serverVersion: number;
  serverData: Record<string, unknown>;
  serverUpdatedBy: string | null;
  serverUpdatedAt: string;
  conflictingFields: string[];
}

// La versión enviada no coincide con la del servidor: se devuelven los datos actuales para que
// el cliente decida, en lugar de sobrescribir en silencio (RNF-01).
export class ExcepcionConflictoVersion extends HttpException {
  constructor(readonly conflicto: ConflictoSincronizacion) {
    super('La versión no coincide con la del servidor.', 409);
  }
}
