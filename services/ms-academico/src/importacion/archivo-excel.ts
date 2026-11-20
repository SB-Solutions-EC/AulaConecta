import { Injectable, PipeTransform } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArchivoSubido, LibroValidado, validarLibroExcel } from './libro-excel';
import { LIMITES_CARGA } from './limites';

/**
 * Recibe el campo multipart "archivo" en memoria. multer corta la subida en cuanto pasa el tamaño
 * máximo (413), y rechaza más de un archivo, otro nombre de campo o demasiados campos (400).
 * Nunca se escribe en disco ni se usa el nombre que manda el cliente para guardar nada.
 */
export const ArchivoExcelInterceptor = FileInterceptor('archivo', {
  // Sin storage ni dest, multer guarda en memoria (MemoryStorage)
  limits: {
    fileSize: LIMITES_CARGA.bytes,
    files: 1,
    fields: 5,
    fieldSize: 1024,
    parts: 6,
    headerPairs: 50,
  },
});

/** Aplica los controles de carga y entrega el libro validado al controlador. */
@Injectable()
export class ArchivoExcelPipe implements PipeTransform<ArchivoSubido | undefined, LibroValidado> {
  transform(archivo: ArchivoSubido | undefined): LibroValidado {
    return validarLibroExcel(archivo);
  }
}
