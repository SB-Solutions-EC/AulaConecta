import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorApi, ExcepcionApi } from './excepcion-api';

interface Traduccion {
  codigo: string;
  mensaje: string;
}

// Mensajes genéricos: nunca se devuelve el texto interno del error (SQL, rutas, pila).
const POR_ESTADO: Record<number, Traduccion> = {
  400: { codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos enviados no son válidos.' },
  401: { codigo: 'NO_AUTORIZADO', mensaje: 'Inicia sesión para continuar.' },
  403: { codigo: 'ACCESO_DENEGADO', mensaje: 'No tienes permiso para esta acción.' },
  404: { codigo: 'NO_ENCONTRADO', mensaje: 'El recurso no existe.' },
  405: { codigo: 'METODO_NO_PERMITIDO', mensaje: 'Método no permitido.' },
  409: { codigo: 'CONFLICTO', mensaje: 'El recurso ya existe o cambió mientras lo editabas.' },
  413: { codigo: 'SOLICITUD_MUY_GRANDE', mensaje: 'La solicitud supera el tamaño permitido.' },
  415: { codigo: 'TIPO_NO_ADMITIDO', mensaje: 'Envía los datos como application/json.' },
  429: { codigo: 'DEMASIADAS_SOLICITUDES', mensaje: 'Demasiadas solicitudes, intenta más tarde.' },
};
const ERROR_INTERNO: Traduccion = { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' };

@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly registro = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const { estado, cuerpo } = this.traducir(error);
    respuesta.status(estado).json(cuerpo);
  }

  traducir(error: unknown): { estado: number; cuerpo: ErrorApi } {
    const timestamp = new Date().toISOString();

    if (error instanceof ExcepcionApi) {
      const cuerpo: ErrorApi = { codigo: error.codigo, mensaje: error.message, timestamp };
      if (error.detalles?.length) {
        cuerpo.detalles = error.detalles;
      }
      return { estado: error.getStatus(), cuerpo };
    }

    // Nest ya convierte en HttpException los errores del lector de JSON (JSON mal formado,
    // cuerpo muy grande); su mensaje trae el fragmento que falló y por eso no se reenvía.
    const estado = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const traduccion = POR_ESTADO[estado] ?? (estado < 500 ? POR_ESTADO[400] : ERROR_INTERNO);
    if (estado >= 500) {
      // El detalle queda solo en el registro del servidor
      this.registro.error(error instanceof Error ? error.stack : String(error));
    }
    return { estado, cuerpo: { ...traduccion, timestamp } };
  }
}
