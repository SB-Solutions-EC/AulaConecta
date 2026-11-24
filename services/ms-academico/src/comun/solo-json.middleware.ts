import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ExcepcionApi } from './excepcion-api';

const CON_CUERPO = new Set(['POST', 'PUT', 'PATCH']);

/**
 * La API solo recibe JSON (y multipart para la importación de nóminas en Excel).
 * Express también interpreta formularios urlencoded: sin este filtro un formulario HTML
 * podría crear registros con otro formato que nadie revisó.
 */
@Injectable()
export class SoloJsonMiddleware implements NestMiddleware {
  use(peticion: Request, _respuesta: Response, siguiente: NextFunction): void {
    const traeCuerpo = peticion.headers['content-type'] !== undefined || Number(peticion.headers['content-length'] ?? 0) > 0;
    if (CON_CUERPO.has(peticion.method) && traeCuerpo && !peticion.is(['application/json', 'multipart/form-data'])) {
      throw new ExcepcionApi(415, 'TIPO_NO_ADMITIDO', 'Envía los datos como application/json.');
    }
    siguiente();
  }
}
