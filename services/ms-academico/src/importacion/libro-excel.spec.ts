import { crearLibro, filasNomina, hojaXml } from '../../test/seguridad/archivos-excel';
import { CASOS_ARCHIVO } from '../../test/seguridad/archivos-invalidos';
import { ExcepcionApi } from '../comun/excepcion-api';
import { ArchivoSubido, validarLibroExcel } from './libro-excel';
import { LIMITES_CARGA, MIME_XLSX } from './limites';

const subido = (contenido: Buffer, originalname = 'nomina.xlsx', mimetype = MIME_XLSX): ArchivoSubido => ({ originalname, mimetype, size: contenido.length, buffer: contenido });

function rechazo(archivo: ArchivoSubido | undefined): ExcepcionApi {
  try {
    validarLibroExcel(archivo);
  } catch (error) {
    expect(error).toBeInstanceOf(ExcepcionApi);
    return error as ExcepcionApi;
  }
  throw new Error('El archivo debía rechazarse');
}

describe('validarLibroExcel', () => {
  it('entrega el libro con las filas contadas y el nombre sin ruta', () => {
    const libro = validarLibroExcel(subido(crearLibro({ hojas: [hojaXml(filasNomina(12))] }), 'C:\\Users\\secretaria\\Nómina 8vo A.XLSX'));

    expect(libro).toMatchObject({ nombre: 'Nómina 8vo A.XLSX', filasDeDatos: 12, hojas: [{ archivo: 'xl/worksheets/sheet1.xml', filas: 13 }] });
  });

  it('acepta el tipo genérico application/octet-stream que mandan algunos navegadores', () => {
    expect(validarLibroExcel(subido(crearLibro(), 'nomina.xlsx', 'application/octet-stream')).filasDeDatos).toBe(3);
  });

  it('revisa todas las hojas en orden y cuenta los datos de la primera', () => {
    const hojas = Array.from({ length: LIMITES_CARGA.hojas }, (_, i) => hojaXml(filasNomina(i + 1)));
    const libro = validarLibroExcel(subido(crearLibro({ hojas })));

    expect(libro.hojas.map((h) => h.archivo)).toEqual(hojas.map((_, i) => `xl/worksheets/sheet${i + 1}.xml`));
    expect(libro.filasDeDatos).toBe(1);
  });

  it('acepta exactamente el límite de filas', () => {
    expect(validarLibroExcel(subido(crearLibro({ hojas: [hojaXml(filasNomina(LIMITES_CARGA.filas))] }))).filasDeDatos).toBe(LIMITES_CARGA.filas);
  });

  it('pide el archivo si no llegó', () => {
    expect(rechazo(undefined).codigo).toBe('ARCHIVO_REQUERIDO');
  });

  it('rechaza un archivo más grande que el límite aunque multer no lo haya cortado', () => {
    const error = rechazo(subido(Buffer.concat([crearLibro(), Buffer.alloc(LIMITES_CARGA.bytes)])));
    expect([error.getStatus(), error.codigo]).toEqual([413, 'SOLICITUD_MUY_GRANDE']);
  });

  it.each(['nomina\u0000.xlsx', `${'n'.repeat(LIMITES_CARGA.longitudNombre)}.xlsx`])('rechaza el nombre %j', (nombre) => {
    expect(rechazo(subido(crearLibro(), nombre)).codigo).toBe('TIPO_NO_ADMITIDO');
  });

  // El mismo catálogo que se prueba por HTTP, aquí sin multer de por medio (salvo el tamaño, que corta multer)
  it.each(CASOS_ARCHIVO.filter((caso) => caso.estado !== 413).map((caso) => [caso.nombre, caso] as const))('%s', (_nombre, caso) => {
    const { contenido, nombreArchivo, tipo } = caso.archivo();
    const error = rechazo(subido(contenido, nombreArchivo, tipo));

    expect([error.getStatus(), error.codigo]).toEqual([caso.estado, caso.codigo]);
  });
});
