import { LIMITES_CARGA, MIME_XLSX } from '../../src/importacion/limites';
import { crearLibro, crearZip, filasNomina, hojaXml, partesLibro, TIPO_LIBRO } from './archivos-excel';

// Catálogo de archivos inválidos para la importación de nóminas (RF-04, T1112-A).
// Cada caso dice qué debe responder el servidor: estado y código de ErrorApi.

export interface ArchivoDePrueba {
  nombreArchivo: string;
  tipo: string;
  contenido: Buffer;
}

export interface CasoArchivo {
  nombre: string;
  archivo: () => ArchivoDePrueba;
  estado: number;
  codigo: string;
}

const xlsx = (contenido: Buffer, nombreArchivo = 'nomina.xlsx', tipo = MIME_XLSX): ArchivoDePrueba => ({ nombreArchivo, tipo, contenido });
const MiB = 1024 * 1024;

/** Libro con una celda en la hoja que se arma a mano (para índices o columnas fuera de rango). */
const hojaCruda = (filasXml: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filasXml}</sheetData></worksheet>`;

export const CASOS_ARCHIVO: CasoArchivo[] = [
  // ---------- Tamaño ----------
  { nombre: 'archivo vacío (0 bytes)', archivo: () => xlsx(Buffer.alloc(0)), estado: 400, codigo: 'ARCHIVO_VACIO' },
  {
    nombre: `más de ${LIMITES_CARGA.bytes / MiB} MB`,
    archivo: () => xlsx(Buffer.concat([crearLibro(), Buffer.alloc(LIMITES_CARGA.bytes)])),
    estado: 413,
    codigo: 'SOLICITUD_MUY_GRANDE',
  },

  // ---------- Nombre y tipo declarados ----------
  ...['nomina.csv', 'nomina.xls', 'nomina.xlsm', 'nomina.exe', 'nomina.xlsx.exe', 'nomina', '.xlsx'].map((nombreArchivo) => ({
    nombre: `nombre "${nombreArchivo}"`,
    archivo: () => xlsx(crearLibro(), nombreArchivo),
    estado: 415,
    codigo: 'TIPO_NO_ADMITIDO',
  })),
  ...['text/csv', 'application/pdf', 'application/x-msdownload', 'text/html'].map((tipo) => ({
    nombre: `tipo declarado ${tipo}`,
    archivo: () => xlsx(crearLibro(), 'nomina.xlsx', tipo),
    estado: 415,
    codigo: 'TIPO_NO_ADMITIDO',
  })),

  // ---------- Contenido que no es un .xlsx aunque lo diga ----------
  { nombre: 'un CSV renombrado a .xlsx', archivo: () => xlsx(Buffer.from('cedula,nombres\n0000000000,Ana\n')), estado: 415, codigo: 'TIPO_NO_ADMITIDO' },
  { nombre: 'un PDF renombrado', archivo: () => xlsx(Buffer.from('%PDF-1.7\n%\u00e2\u00e3\n1 0 obj\n')), estado: 415, codigo: 'TIPO_NO_ADMITIDO' },
  { nombre: 'un ejecutable de Windows renombrado', archivo: () => xlsx(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(512)])), estado: 415, codigo: 'TIPO_NO_ADMITIDO' },
  { nombre: 'un HTML con script renombrado', archivo: () => xlsx(Buffer.from('<html><script>alert(1)</script></html>')), estado: 415, codigo: 'TIPO_NO_ADMITIDO' },
  {
    nombre: 'un Excel antiguo (.xls) o protegido con contraseña',
    archivo: () => xlsx(Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(1024)])),
    estado: 415,
    codigo: 'TIPO_NO_ADMITIDO',
  },
  {
    nombre: 'un Word (.docx) renombrado',
    archivo: () =>
      xlsx(
        crearZip([
          { nombre: '[Content_Types].xml', datos: '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
          { nombre: 'word/document.xml', datos: '<document/>' },
        ]),
      ),
    estado: 415,
    codigo: 'TIPO_NO_ADMITIDO',
  },
  { nombre: 'un ZIP cualquiera', archivo: () => xlsx(crearZip([{ nombre: 'leeme.txt', datos: 'hola' }])), estado: 415, codigo: 'TIPO_NO_ADMITIDO' },
  {
    nombre: 'una plantilla (.xltx) renombrada',
    archivo: () => xlsx(crearLibro({ tiposContenido: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml' })),
    estado: 415,
    codigo: 'TIPO_NO_ADMITIDO',
  },

  // ---------- Macros ----------
  {
    nombre: 'un libro con macros (vbaProject.bin)',
    archivo: () => xlsx(crearLibro({ extra: [{ nombre: 'xl/vbaProject.bin', datos: Buffer.alloc(64, 1) }] })),
    estado: 415,
    codigo: 'ARCHIVO_CON_MACROS',
  },
  {
    nombre: 'un .xlsm renombrado (tipo macroEnabled)',
    archivo: () => xlsx(crearLibro({ tiposContenido: 'application/vnd.ms-excel.sheet.macroEnabled.main+xml' })),
    estado: 415,
    codigo: 'ARCHIVO_CON_MACROS',
  },

  // ---------- Archivos dañados ----------
  { nombre: 'un .xlsx cortado a la mitad', archivo: () => xlsx(crearLibro().subarray(0, 300)), estado: 400, codigo: 'ARCHIVO_DANADO' },
  {
    nombre: 'un .xlsx con bytes alterados (CRC no coincide)',
    archivo: () => {
      // La hoja va sin comprimir para alterar un byte de su texto: el CRC deja de coincidir
      const zip = crearZip(partesLibro().map((p) => (p.nombre === 'xl/worksheets/sheet1.xml' ? { ...p, almacenar: true } : p)));
      zip[zip.indexOf('cedula')] = 0x43;
      return xlsx(zip);
    },
    estado: 400,
    codigo: 'ARCHIVO_DANADO',
  },

  // ---------- Bombas ZIP y estructuras de ataque ----------
  {
    nombre: 'una bomba ZIP (hoja de 30 MB declarada)',
    archivo: () => xlsx(crearLibro({ hojas: [`${hojaXml(filasNomina(1)).replace('</sheetData>', '')}${' '.repeat(30 * MiB)}</sheetData></worksheet>`] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: 'una bomba ZIP que declara 1 KB y se descomprime en 30 MB',
    archivo: () =>
      xlsx(
        crearZip(
          partesLibro().map((p) =>
            p.nombre === 'xl/worksheets/sheet1.xml' ? { ...p, datos: `${String(p.datos)}${' '.repeat(30 * MiB)}`, declarar: 1024 } : p,
          ),
        ),
      ),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    // Los controles no descomprimen las imágenes, pero la biblioteca del importador sí podría
    nombre: 'una imagen de 30 MB dentro del libro (bomba para el lector de Excel)',
    archivo: () => xlsx(crearLibro({ extra: [{ nombre: 'xl/media/imagen1.png', datos: Buffer.alloc(30 * MiB) }] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: `más de ${LIMITES_CARGA.entradasZip} archivos dentro del ZIP`,
    archivo: () => xlsx(crearLibro({ extra: Array.from({ length: LIMITES_CARGA.entradasZip }, (_, i) => ({ nombre: `xl/media/relleno${i}.txt`, datos: 'x' })) })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  ...['../../etc/cron.d/tarea', '/etc/passwd', 'xl\\..\\..\\malo.xml', 'C:/Windows/malo.xml'].map((ruta) => ({
    nombre: `una entrada con ruta peligrosa ${ruta} (zip slip)`,
    archivo: () => xlsx(crearLibro({ extra: [{ nombre: ruta, datos: 'x' }] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  })),
  {
    nombre: 'una entrada repetida con otro contenido',
    archivo: () => xlsx(crearZip([...partesLibro(), { nombre: 'xl/worksheets/sheet1.xml', datos: hojaXml(filasNomina(1)) }])),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: 'una entrada cifrada',
    archivo: () => xlsx(crearZip(partesLibro().map((p) => (p.nombre === 'xl/worksheets/sheet1.xml' ? { ...p, cifrada: true } : p)))),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: 'una entidad externa XXE en la hoja',
    archivo: () =>
      xlsx(crearLibro({ hojas: [hojaXml([['&xxe;']], '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>').replace('&amp;xxe;', '&xxe;')] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: 'una expansión de entidades ("mil millones de risas") en sharedStrings',
    archivo: () =>
      xlsx(
        crearLibro({
          extra: [{ nombre: 'xl/sharedStrings.xml', datos: '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "jaja"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]><sst><si><t>&b;</t></si></sst>' }],
        }),
      ),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },
  {
    nombre: 'una parte en UTF-16 (puede esconder un DOCTYPE)',
    archivo: () => xlsx(crearLibro({ hojas: [Buffer.from(hojaXml(filasNomina(1)), 'utf16le').toString('latin1')] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },

  {
    nombre: 'un vínculo a otro libro (externalLinks)',
    archivo: () => xlsx(crearLibro({ extra: [{ nombre: 'xl/externalLinks/externalLink1.xml', datos: '<externalLink/>' }] })),
    estado: 400,
    codigo: 'ARCHIVO_SOSPECHOSO',
  },

  // ---------- Fórmulas (modelo de amenazas T-04) ----------
  ...[
    ['=HYPERLINK("http://sitio.invalid","clic")', 'HYPERLINK'],
    ['1+1', 'una suma'],
  ].map(([formula, descripcion]) => ({
    nombre: `una celda con fórmula (${descripcion})`,
    archivo: () =>
      xlsx(crearLibro({ hojas: [hojaCruda(`<row r="1"><c r="A1" t="inlineStr"><is><t>cedula</t></is></c></row><row r="2"><c r="A2"><f>${formula.replace(/"/g, '&quot;')}</f><v>2</v></c></row>`)] })),
    estado: 400,
    codigo: 'ARCHIVO_CON_FORMULAS',
  })),

  // ---------- Límites de la nómina ----------
  {
    nombre: `${LIMITES_CARGA.filas + 1} filas de datos`,
    archivo: () => xlsx(crearLibro({ hojas: [hojaXml(filasNomina(LIMITES_CARGA.filas + 1))] })),
    estado: 400,
    codigo: 'DEMASIADAS_FILAS',
  },
  {
    nombre: 'una sola fila con el índice 1048576 (la última de Excel)',
    archivo: () => xlsx(crearLibro({ hojas: [hojaCruda('<row r="1"><c r="A1" t="inlineStr"><is><t>cedula</t></is></c></row><row r="1048576"><c r="A1048576"><v>1</v></c></row>')] })),
    estado: 400,
    codigo: 'DEMASIADAS_FILAS',
  },
  {
    nombre: `una celda en la columna ${LIMITES_CARGA.columnas + 1}`,
    archivo: () => xlsx(crearLibro({ hojas: [hojaCruda('<row r="1"><c r="A1" t="inlineStr"><is><t>cedula</t></is></c><c r="AE1"><v>1</v></c></row><row r="2"><c r="A2"><v>1</v></c></row>')] })),
    estado: 400,
    codigo: 'DEMASIADAS_COLUMNAS',
  },
  {
    nombre: `${LIMITES_CARGA.hojas + 1} hojas`,
    archivo: () => xlsx(crearLibro({ hojas: Array.from({ length: LIMITES_CARGA.hojas + 1 }, () => hojaXml(filasNomina(1))) })),
    estado: 400,
    codigo: 'DEMASIADAS_HOJAS',
  },
  { nombre: 'solo el encabezado, sin estudiantes', archivo: () => xlsx(crearLibro({ hojas: [hojaXml(filasNomina(0))] })), estado: 400, codigo: 'ARCHIVO_SIN_DATOS' },
  {
    nombre: 'un libro sin hojas',
    archivo: () => xlsx(crearZip(partesLibro().filter((p) => !p.nombre.startsWith('xl/worksheets/')))),
    estado: 400,
    codigo: 'ARCHIVO_SIN_DATOS',
  },
];

/** Usado por el control positivo: el libro que la suite considera válido. */
export function nominaValida(filas = 3): ArchivoDePrueba {
  return xlsx(crearLibro({ hojas: [hojaXml(filasNomina(filas))] }));
}

export { TIPO_LIBRO };
