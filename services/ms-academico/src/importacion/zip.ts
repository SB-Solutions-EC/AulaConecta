import { crc32, inflateRawSync } from 'node:zlib';

// Lector mínimo de ZIP (un .xlsx es un ZIP) que desconfía del archivo: revisa el directorio central
// antes de descomprimir y nunca descomprime más de lo permitido, aunque los encabezados mientan.

export interface EntradaZip {
  nombre: string;
  metodo: number;
  cifrada: boolean;
  comprimido: number;
  descomprimido: number;
  crc: number;
  desplazamientoLocal: number;
}

/** El archivo no es un ZIP válido o está incompleto. */
export class ZipDanado extends Error {}
/** El ZIP es válido pero tiene una forma usada en ataques (bomba, rutas, cifrado...). */
export class ZipSospechoso extends Error {}

const FIRMA_FIN = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;
const TAMANO_FIN = 22;
const MAXIMO_COMENTARIO = 0xffff;

function leer16(datos: Buffer, posicion: number): number {
  if (posicion + 2 > datos.length) {
    throw new ZipDanado('ZIP truncado');
  }
  return datos.readUInt16LE(posicion);
}

function leer32(datos: Buffer, posicion: number): number {
  if (posicion + 4 > datos.length) {
    throw new ZipDanado('ZIP truncado');
  }
  return datos.readUInt32LE(posicion);
}

function buscarFinDeDirectorio(datos: Buffer): number {
  const desde = Math.max(0, datos.length - TAMANO_FIN - MAXIMO_COMENTARIO);
  for (let posicion = datos.length - TAMANO_FIN; posicion >= desde; posicion--) {
    if (datos.readUInt32LE(posicion) === FIRMA_FIN) {
      return posicion;
    }
  }
  throw new ZipDanado('No se encontró el directorio del ZIP');
}

/** Nombres que podrían escribir fuera de una carpeta al extraerse (zip slip) o confundir a un lector. */
function nombreSeguro(nombre: string): boolean {
  return (
    nombre.length > 0 &&
    nombre.length <= 255 &&
    !nombre.startsWith('/') &&
    !nombre.includes('\\') &&
    !nombre.includes('\0') &&
    !/^[a-zA-Z]:/.test(nombre) &&
    !nombre.split('/').includes('..')
  );
}

/** Lee el directorio central. Rechaza ZIP64, entradas cifradas, nombres peligrosos y repetidos. */
export function leerDirectorio(datos: Buffer, maximoEntradas: number): EntradaZip[] {
  if (datos.length < TAMANO_FIN) {
    throw new ZipDanado('Archivo demasiado corto para ser un ZIP');
  }
  const fin = buscarFinDeDirectorio(datos);
  const total = leer16(datos, fin + 10);
  const tamanoDirectorio = leer32(datos, fin + 12);
  const inicioDirectorio = leer32(datos, fin + 16);
  if (total === 0xffff || inicioDirectorio === 0xffffffff) {
    throw new ZipSospechoso('ZIP64 no admitido');
  }
  if (total > maximoEntradas) {
    throw new ZipSospechoso(`El ZIP tiene ${total} archivos`);
  }
  if (inicioDirectorio + tamanoDirectorio > fin) {
    throw new ZipDanado('Directorio del ZIP fuera de rango');
  }

  const entradas: EntradaZip[] = [];
  const nombres = new Set<string>();
  let posicion = inicioDirectorio;
  for (let i = 0; i < total; i++) {
    if (leer32(datos, posicion) !== FIRMA_CENTRAL) {
      throw new ZipDanado('Entrada del directorio inválida');
    }
    const largoNombre = leer16(datos, posicion + 28);
    const fin = posicion + 46 + largoNombre;
    if (fin > datos.length) {
      throw new ZipDanado('ZIP truncado');
    }
    const nombre = datos.toString('utf8', posicion + 46, fin);
    if (!nombreSeguro(nombre)) {
      throw new ZipSospechoso('Nombre de archivo peligroso dentro del ZIP');
    }
    if (nombres.has(nombre)) {
      throw new ZipSospechoso('Archivo repetido dentro del ZIP');
    }
    nombres.add(nombre);
    entradas.push({
      nombre,
      cifrada: (leer16(datos, posicion + 8) & 0x1) === 1,
      metodo: leer16(datos, posicion + 10),
      crc: leer32(datos, posicion + 16),
      comprimido: leer32(datos, posicion + 20),
      descomprimido: leer32(datos, posicion + 24),
      desplazamientoLocal: leer32(datos, posicion + 42),
    });
    posicion = fin + leer16(datos, posicion + 30) + leer16(datos, posicion + 32);
  }
  return entradas;
}

/**
 * Descomprime una entrada sin pasar de lo que declara el directorio (ni de `maximo`).
 * Si el contenido real es más grande que lo declarado, se corta: es una bomba ZIP.
 */
export function extraer(datos: Buffer, entrada: EntradaZip, maximo: number): Buffer {
  if (entrada.cifrada) {
    throw new ZipSospechoso('Entrada cifrada');
  }
  if (entrada.descomprimido > maximo) {
    throw new ZipSospechoso(`${entrada.nombre} ocupa demasiado al descomprimirse`);
  }
  const local = entrada.desplazamientoLocal;
  if (leer32(datos, local) !== FIRMA_LOCAL) {
    throw new ZipDanado('Encabezado local inválido');
  }
  const inicio = local + 30 + leer16(datos, local + 26) + leer16(datos, local + 28);
  const fin = inicio + entrada.comprimido;
  if (fin > datos.length) {
    throw new ZipDanado('ZIP truncado');
  }
  const comprimido = datos.subarray(inicio, fin);

  let contenido: Buffer;
  if (entrada.metodo === 0) {
    contenido = comprimido;
  } else if (entrada.metodo === 8) {
    try {
      // +1: si sale un byte más de lo declarado, el encabezado mintió
      contenido = inflateRawSync(comprimido, { maxOutputLength: entrada.descomprimido + 1 });
    } catch (error) {
      if (error instanceof RangeError || (error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
        throw new ZipSospechoso(`${entrada.nombre} se descomprime más de lo que declara`);
      }
      throw new ZipDanado(`${entrada.nombre} no se puede descomprimir`);
    }
  } else {
    throw new ZipDanado(`Método de compresión ${entrada.metodo} no admitido`);
  }

  if (contenido.length > entrada.descomprimido) {
    throw new ZipSospechoso(`${entrada.nombre} se descomprime más de lo que declara`);
  }
  if (contenido.length !== entrada.descomprimido || crc32(contenido) !== entrada.crc) {
    throw new ZipDanado(`${entrada.nombre} está dañado`);
  }
  return contenido;
}
