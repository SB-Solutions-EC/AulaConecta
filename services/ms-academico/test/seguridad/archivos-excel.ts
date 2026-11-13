import { crc32, deflateRawSync } from 'node:zlib';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';

// Fábrica de archivos para las pruebas de carga (T1112-A): arma ZIP y libros .xlsx al ejecutar,
// así el repositorio no guarda binarios ni datos reales y cada ataque se arma a la medida.

export interface ParteZip {
  nombre: string;
  datos: Buffer | string;
  /** Guardar sin comprimir (método 0). */
  almacenar?: boolean;
  /** Tamaño descomprimido que se declara en los encabezados (para simular uno que miente). */
  declarar?: number;
  cifrada?: boolean;
}

export function crearZip(partes: ParteZip[]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const parte of partes) {
    const nombre = Buffer.from(parte.nombre, 'utf8');
    const original = Buffer.isBuffer(parte.datos) ? parte.datos : Buffer.from(parte.datos, 'utf8');
    const datos = parte.almacenar ? original : deflateRawSync(original);
    const banderas = 0x800 | (parte.cifrada ? 0x1 : 0);
    const metodo = parte.almacenar ? 0 : 8;
    const descomprimido = parte.declarar ?? original.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(banderas, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc32(original), 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(descomprimido, 22);
    local.writeUInt16LE(nombre.length, 26);
    locales.push(local, nombre, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(banderas, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc32(original), 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(descomprimido, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);
    desplazamiento += local.length + nombre.length + datos.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(partes.length, 8);
  fin.writeUInt16LE(partes.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const TIPO_LIBRO = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';

const escapar = (valor: string): string => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const columna = (indice: number): string => (indice < 26 ? '' : columna(Math.floor(indice / 26) - 1)) + String.fromCharCode(65 + (indice % 26));

/** Hoja con celdas de texto en línea (sin sharedStrings): `filas[0]` es el encabezado. */
export function hojaXml(filas: string[][], prologo = XML): string {
  const cuerpo = filas
    .map((celdas, i) => `<row r="${i + 1}">${celdas.map((v, j) => `<c r="${columna(j)}${i + 1}" t="inlineStr"><is><t>${escapar(v)}</t></is></c>`).join('')}</row>`)
    .join('');
  return `${prologo}<worksheet xmlns="${NS}"><sheetData>${cuerpo}</sheetData></worksheet>`;
}

export const ENCABEZADO = ['cedula', 'nombres', 'apellidos'];

/** Filas de una nómina ficticia: cédulas y nombres generados al ejecutar. */
export function filasNomina(cantidad: number): string[][] {
  return [ENCABEZADO, ...Array.from({ length: cantidad }, () => [cedulaFicticia(), palabraFicticia(), palabraFicticia()])];
}

export interface OpcionesLibro {
  /** Hojas del libro (XML de cada una). Por defecto, una nómina de 3 estudiantes. */
  hojas?: string[];
  tiposContenido?: string;
  /** Partes adicionales (macros, entradas peligrosas...). */
  extra?: ParteZip[];
}

/** Partes de un .xlsx mínimo que Excel abre. */
export function partesLibro({ hojas = [hojaXml(filasNomina(3))], tiposContenido = TIPO_LIBRO, extra = [] }: OpcionesLibro = {}): ParteZip[] {
  const overrides = hojas
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  return [
    {
      nombre: '[Content_Types].xml',
      datos: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${tiposContenido}"/>${overrides}</Types>`,
    },
    {
      nombre: '_rels/.rels',
      datos: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      datos: `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${hojas.map((_, i) => `<sheet name="Hoja${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      datos: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    },
    ...hojas.map((xml, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: xml })),
    ...extra,
  ];
}

export function crearLibro(opciones: OpcionesLibro = {}): Buffer {
  return crearZip(partesLibro(opciones));
}
