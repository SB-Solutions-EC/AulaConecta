import { ExcepcionApi } from '../comun/excepcion-api';
import { LIMITES_CARGA, MIME_XLSX } from './limites';
import { EntradaZip, extraer, leerDirectorio, ZipDanado, ZipSospechoso } from './zip';

/** Lo que entrega multer con almacenamiento en memoria (sin depender de @types/multer). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface HojaRevisada {
  archivo: string;
  filas: number;
}

/** Un libro que pasó los controles de carga: el importador ya puede leerlo con su biblioteca. */
export interface LibroValidado {
  nombre: string;
  contenido: Buffer;
  hojas: HojaRevisada[];
  /** Filas de la primera hoja sin contar el encabezado. */
  filasDeDatos: number;
}

const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// Formato OLE: Excel 97-2003 (.xls) y también los .xlsx protegidos con contraseña
const FIRMA_OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MIMES_ADMITIDOS = new Set([MIME_XLSX, 'application/octet-stream']);
const PARTE_GRANDE = 1024 * 1024;

const ESTADO_TIPO = 415;
const tipoNoAdmitido = (mensaje: string): ExcepcionApi => new ExcepcionApi(ESTADO_TIPO, 'TIPO_NO_ADMITIDO', mensaje);
const sospechoso = (): ExcepcionApi =>
  new ExcepcionApi(400, 'ARCHIVO_SOSPECHOSO', 'El archivo tiene una estructura no permitida. Ábrelo en Excel y guárdalo de nuevo como .xlsx.');
const danado = (): ExcepcionApi =>
  new ExcepcionApi(400, 'ARCHIVO_DANADO', 'El archivo está dañado o incompleto. Ábrelo en Excel y guárdalo de nuevo como .xlsx.');

function revisarNombreYTipo(archivo: ArchivoSubido): string {
  const nombre = (archivo.originalname ?? '').split(/[\\/]/).pop() ?? '';
  // Sin caracteres de control (ni el byte nulo, que en algunos sistemas corta "nomina.xlsx\0.exe")
  if (nombre.length > LIMITES_CARGA.longitudNombre || /[\u0000-\u001f\u007f]/.test(nombre) || !/^[^.].*\.xlsx$/i.test(nombre)) {
    throw tipoNoAdmitido('Solo se admiten libros de Excel con extensión .xlsx.');
  }
  if (!MIMES_ADMITIDOS.has(archivo.mimetype)) {
    throw tipoNoAdmitido('Solo se admiten libros de Excel con extensión .xlsx.');
  }
  return nombre;
}

function revisarFirma(contenido: Buffer): void {
  if (contenido.subarray(0, 8).equals(FIRMA_OLE)) {
    throw tipoNoAdmitido('Es un Excel antiguo (.xls) o tiene contraseña: guárdalo como .xlsx sin contraseña.');
  }
  // La extensión y el tipo los decide quien sube el archivo; el contenido no miente
  if (!contenido.subarray(0, 4).equals(FIRMA_ZIP)) {
    throw tipoNoAdmitido('El contenido no es un libro de Excel (.xlsx).');
  }
}

function texto(contenido: Buffer): string {
  // UTF-16 tendría bytes nulos y podría esconder una declaración DOCTYPE a una búsqueda simple
  if (contenido.includes(0)) {
    throw sospechoso();
  }
  const xml = contenido.toString('utf8');
  // Sin DTD no hay entidades externas (XXE) ni expansión de entidades ("mil millones de risas")
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw sospechoso();
  }
  return xml;
}

function contar(xml: string, patron: RegExp): number {
  return xml.match(patron)?.length ?? 0;
}

function columnaANumero(letras: string): number {
  return [...letras].reduce((total, letra) => total * 26 + (letra.charCodeAt(0) - 64), 0);
}

function revisarHoja(archivo: string, xml: string): HojaRevisada {
  const filas = contar(xml, /<(?:\w+:)?row[\s>/]/g);
  const mayorIndice = Math.max(0, ...[...xml.matchAll(/<(?:\w+:)?row\b[^>]*?\sr="(\d+)"/g)].map((m) => Number(m[1])));
  // Encabezado + filas de datos. También se mira el índice: una sola fila r="1048576" obliga a algunos lectores a reservar todo
  if (filas > LIMITES_CARGA.filas + 1 || mayorIndice > LIMITES_CARGA.filas + 1) {
    throw new ExcepcionApi(400, 'DEMASIADAS_FILAS', `La nómina admite hasta ${LIMITES_CARGA.filas} filas de datos por hoja.`);
  }
  const mayorColumna = Math.max(0, ...[...xml.matchAll(/<(?:\w+:)?c\b[^>]*?\sr="([A-Z]{1,3})\d+"/g)].map((m) => columnaANumero(m[1])));
  if (mayorColumna > LIMITES_CARGA.columnas) {
    throw new ExcepcionApi(400, 'DEMASIADAS_COLUMNAS', `La nómina admite hasta ${LIMITES_CARGA.columnas} columnas.`);
  }
  // Una nómina no necesita fórmulas; una como =HYPERLINK(...) podría guardarse y salir luego en una exportación (T-04)
  if (/<(?:\w+:)?f[\s>/]/.test(xml)) {
    throw new ExcepcionApi(400, 'ARCHIVO_CON_FORMULAS', 'La nómina tiene fórmulas: copia las celdas y pégalas como valores.');
  }
  return { archivo, filas };
}

function revisarZip(contenido: Buffer): EntradaZip[] {
  const entradas = leerDirectorio(contenido, LIMITES_CARGA.entradasZip);
  const total = entradas.reduce((suma, e) => suma + e.descomprimido, 0);
  const desproporcionada = entradas.some(
    (e) => e.descomprimido > PARTE_GRANDE && e.descomprimido / Math.max(e.comprimido, 1) > LIMITES_CARGA.razonCompresion,
  );
  if (total > LIMITES_CARGA.descomprimidoTotal || desproporcionada) {
    throw new ZipSospechoso('Bomba ZIP');
  }
  return entradas;
}

function revisarContenido(nombre: string, contenido: Buffer): LibroValidado {
  const entradas = revisarZip(contenido);
  const porNombre = new Map(entradas.map((e) => [e.nombre, e]));
  if (entradas.some((e) => /(^|\/)vbaProject\.bin$/i.test(e.nombre))) {
    throw new ExcepcionApi(ESTADO_TIPO, 'ARCHIVO_CON_MACROS', 'El archivo tiene macros: guárdalo como .xlsx (libro sin macros).');
  }
  // Vínculos a otros libros: un lector podría seguirlos fuera del archivo
  if (entradas.some((e) => e.nombre.toLowerCase().startsWith('xl/externallinks/'))) {
    throw sospechoso();
  }
  if (!porNombre.has('[Content_Types].xml') || !porNombre.has('xl/workbook.xml')) {
    throw tipoNoAdmitido('El contenido no es un libro de Excel (.xlsx).');
  }

  // Se descomprime cada parte XML una sola vez, sin pasar del presupuesto total
  let presupuesto: number = LIMITES_CARGA.descomprimidoTotal;
  const partes = new Map<string, string>();
  for (const entrada of entradas.filter((e) => /\.(xml|rels)$/i.test(e.nombre))) {
    const datos = extraer(contenido, entrada, presupuesto);
    presupuesto -= datos.length;
    partes.set(entrada.nombre, texto(datos));
  }

  const tipos = partes.get('[Content_Types].xml') ?? '';
  if (/macroEnabled/i.test(tipos)) {
    throw new ExcepcionApi(ESTADO_TIPO, 'ARCHIVO_CON_MACROS', 'El archivo tiene macros: guárdalo como .xlsx (libro sin macros).');
  }
  // Un .docx o una plantilla .xltx renombrados también son ZIP: tiene que ser un libro normal
  if (!tipos.includes('spreadsheetml.sheet.main+xml')) {
    throw tipoNoAdmitido('El contenido no es un libro de Excel (.xlsx).');
  }

  const hojasDeclaradas = contar(partes.get('xl/workbook.xml') ?? '', /<(?:\w+:)?sheet\s/g);
  if (hojasDeclaradas > LIMITES_CARGA.hojas) {
    throw new ExcepcionApi(400, 'DEMASIADAS_HOJAS', `El libro admite hasta ${LIMITES_CARGA.hojas} hojas.`);
  }
  const hojas = [...partes.entries()]
    .filter(([archivo]) => /^xl\/worksheets\/[^/]+\.xml$/i.test(archivo))
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([archivo, xml]) => revisarHoja(archivo, xml));
  if (hojasDeclaradas === 0 || hojas.length === 0 || hojas.length > LIMITES_CARGA.hojas) {
    throw new ExcepcionApi(400, 'ARCHIVO_SIN_DATOS', 'El libro no tiene hojas con datos.');
  }

  const filasDeDatos = Math.max(0, hojas[0].filas - 1);
  if (filasDeDatos === 0) {
    throw new ExcepcionApi(400, 'ARCHIVO_SIN_DATOS', 'La primera hoja no tiene filas debajo del encabezado.');
  }
  return { nombre, contenido, hojas, filasDeDatos };
}

/**
 * Controles de carga de la nómina (RF-04): nombre y tipo declarados, tamaño, contenido real de Excel,
 * sin macros, sin DTD y dentro de los límites de LIMITES_CARGA. No interpreta los datos: eso le toca al
 * importador, que recibe un libro que ya no puede agotar la memoria ni el procesador del servicio.
 */
export function validarLibroExcel(archivo: ArchivoSubido | undefined): LibroValidado {
  if (!archivo) {
    throw new ExcepcionApi(400, 'ARCHIVO_REQUERIDO', 'Adjunta la nómina en el campo "archivo".');
  }
  const nombre = revisarNombreYTipo(archivo);
  const contenido = archivo.buffer;
  if (!contenido || contenido.length === 0) {
    throw new ExcepcionApi(400, 'ARCHIVO_VACIO', 'El archivo está vacío.');
  }
  if (contenido.length > LIMITES_CARGA.bytes) {
    throw new ExcepcionApi(413, 'SOLICITUD_MUY_GRANDE', `El archivo supera los ${LIMITES_CARGA.bytes / (1024 * 1024)} MB permitidos.`);
  }
  revisarFirma(contenido);
  try {
    return revisarContenido(nombre, contenido);
  } catch (error) {
    if (error instanceof ZipSospechoso) {
      throw sospechoso();
    }
    if (error instanceof ZipDanado) {
      throw danado();
    }
    throw error;
  }
}
