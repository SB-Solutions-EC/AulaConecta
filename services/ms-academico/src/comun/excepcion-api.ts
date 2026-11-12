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
