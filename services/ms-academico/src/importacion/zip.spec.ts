import { deflateRawSync } from 'node:zlib';
import { crearZip } from '../../test/seguridad/archivos-excel';
import { extraer, leerDirectorio, ZipDanado, ZipSospechoso } from './zip';

const MAXIMO = 1024 * 1024;
const simple = (): Buffer => crearZip([{ nombre: 'a.xml', datos: '<a>hola</a>' }, { nombre: 'b.txt', datos: 'chao', almacenar: true }]);
/** Posición del registro de fin de directorio (los últimos 22 bytes, sin comentario). */
const fin = (zip: Buffer): number => zip.length - 22;

describe('leerDirectorio', () => {
  it('lee nombre, método y tamaños de cada entrada', () => {
    const [a, b] = leerDirectorio(simple(), 10);

    expect(a).toMatchObject({ nombre: 'a.xml', metodo: 8, cifrada: false, descomprimido: 11 });
    expect(b).toMatchObject({ nombre: 'b.txt', metodo: 0, comprimido: 4, descomprimido: 4 });
  });

  it.each([
    ['demasiado corto', Buffer.from('PK')],
    ['sin registro de fin', Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(40)])],
  ])('rechaza un archivo %s', (_caso, datos) => {
    expect(() => leerDirectorio(datos, 10)).toThrow(ZipDanado);
  });

  it('rechaza ZIP64 y más entradas de las permitidas', () => {
    const zip64 = simple();
    zip64.writeUInt16LE(0xffff, fin(zip64) + 10);
    expect(() => leerDirectorio(zip64, 10)).toThrow(ZipSospechoso);
    expect(() => leerDirectorio(simple(), 1)).toThrow(ZipSospechoso);
  });

  it('rechaza un directorio fuera de rango o con firmas falsas', () => {
    const fueraDeRango = simple();
    fueraDeRango.writeUInt32LE(fueraDeRango.length, fin(fueraDeRango) + 16);
    expect(() => leerDirectorio(fueraDeRango, 10)).toThrow(ZipDanado);

    const firmaFalsa = simple();
    firmaFalsa.writeUInt32LE(0x12345678, firmaFalsa.readUInt32LE(fin(firmaFalsa) + 16));
    expect(() => leerDirectorio(firmaFalsa, 10)).toThrow(ZipDanado);

    const nombreLargo = simple();
    nombreLargo.writeUInt16LE(0xfff0, nombreLargo.readUInt32LE(fin(nombreLargo) + 16) + 28);
    expect(() => leerDirectorio(nombreLargo, 10)).toThrow(ZipDanado);
  });

  it.each(['', '../x', 'a/../../x', '/x', 'a\\b', 'C:/x', 'a\u0000b', 'x'.repeat(256)])('rechaza el nombre %j', (nombre) => {
    expect(() => leerDirectorio(crearZip([{ nombre, datos: 'x' }]), 10)).toThrow(ZipSospechoso);
  });
});

describe('extraer', () => {
  it('descomprime lo almacenado y lo comprimido', () => {
    const zip = simple();
    const [a, b] = leerDirectorio(zip, 10);

    expect(extraer(zip, a, MAXIMO).toString()).toBe('<a>hola</a>');
    expect(extraer(zip, b, MAXIMO).toString()).toBe('chao');
  });

  it('no descomprime más del máximo pedido', () => {
    const zip = simple();
    expect(() => extraer(zip, leerDirectorio(zip, 10)[0], 5)).toThrow(ZipSospechoso);
  });

  it('rechaza entradas cifradas y métodos desconocidos', () => {
    const zip = simple();
    const [a] = leerDirectorio(zip, 10);
    expect(() => extraer(zip, { ...a, cifrada: true }, MAXIMO)).toThrow(ZipSospechoso);
    expect(() => extraer(zip, { ...a, metodo: 12 }, MAXIMO)).toThrow(ZipDanado);
  });

  it('rechaza un encabezado local falso o datos fuera del archivo', () => {
    const zip = simple();
    const [a] = leerDirectorio(zip, 10);
    expect(() => extraer(zip, { ...a, desplazamientoLocal: 5 }, MAXIMO)).toThrow(ZipDanado);
    expect(() => extraer(zip, { ...a, comprimido: zip.length }, MAXIMO)).toThrow(ZipDanado);
  });

  it('distingue un contenido dañado de uno que se infla más de lo declarado', () => {
    const zip = simple();
    const [a, b] = leerDirectorio(zip, 10);
    // Datos que no son deflate
    const basura = Buffer.concat([zip.subarray(0, 30 + a.nombre.length), Buffer.from([0xff, 0xff, 0xff, 0xff])]);
    expect(() => extraer(basura, { ...a, comprimido: 4 }, MAXIMO)).toThrow(ZipDanado);
    // Almacenado que declara menos de lo que trae
    expect(() => extraer(zip, { ...b, descomprimido: 3 }, MAXIMO)).toThrow(ZipSospechoso);
    // Almacenado con otro CRC
    expect(() => extraer(zip, { ...b, crc: b.crc + 1 }, MAXIMO)).toThrow(ZipDanado);
  });

  it('corta una bomba aunque el encabezado declare poco', () => {
    const bomba = crearZip([{ nombre: 'hoja.xml', datos: ' '.repeat(10 * MAXIMO), declarar: 100 }]);
    expect(deflateRawSync(' '.repeat(10 * MAXIMO)).length).toBeLessThan(20_000);
    expect(() => extraer(bomba, leerDirectorio(bomba, 10)[0], MAXIMO)).toThrow(ZipSospechoso);
  });
});
