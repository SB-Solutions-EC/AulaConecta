import { clienteHttp, type ClienteHttp } from './clienteHttp';

export const TAMANO_MAXIMO_EXCEL_BYTES = 2 * 1024 * 1024;
export const MAX_FILAS_EXCEL = 1000;
export const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ErrorFilaImportacion {
  fila: number;
  mensaje: string;
}

export interface ResultadoImportacionExcel {
  totalFilas: number;
  importados: number;
  errores: ErrorFilaImportacion[];
}

export class ServicioImportacionApi {
  private readonly http: ClienteHttp;

  constructor(http: ClienteHttp = clienteHttp) {
    this.http = http;
  }

  async importarNomina(
    cursoId: string,
    archivo: File,
  ): Promise<ResultadoImportacionExcel> {
    const formData = new FormData();
    formData.append('cursoId', cursoId);
    formData.append('archivo', archivo);
    return this.http.post<ResultadoImportacionExcel>(
      '/api/academico/matriculas/importar',
      formData,
    );
  }
}

export const servicioImportacionApi = new ServicioImportacionApi();
