import { Body, Controller, HttpCode, Module, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Identificador } from '../../../src/comun/validadores';
import { ArchivoExcelInterceptor, ArchivoExcelPipe } from '../../../src/importacion/archivo-excel';
import { LibroValidado } from '../../../src/importacion/libro-excel';
import { Roles } from './guardia-referencia';

// Implementación de referencia de POST /matriculas/importar que usa los controles de carga (T1112-A).
// El importador real (T1112-M) debe recibir el archivo de la misma forma; aquí no se leen los datos.

class SolicitudImportacion {
  @Identificador() cursoId: string;
}

interface ResultadoImportacionExcel {
  totalFilas: number;
  importados: number;
  errores: { fila: number; mensaje: string }[];
}

@Controller()
class ControladorImportacionReferencia {
  @Post('matriculas/importar')
  @Roles('ADMIN', 'SECRETARIA')
  @HttpCode(200)
  @UseInterceptors(ArchivoExcelInterceptor)
  importar(@UploadedFile(ArchivoExcelPipe) libro: LibroValidado, @Body() _solicitud: SolicitudImportacion): ResultadoImportacionExcel {
    // Aquí el importador real leería libro.contenido con su biblioteca de Excel
    return { totalFilas: libro.filasDeDatos, importados: 0, errores: [] };
  }
}

@Module({ controllers: [ControladorImportacionReferencia] })
export class ModuloImportacionReferencia {}
