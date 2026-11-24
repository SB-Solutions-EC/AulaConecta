// Controles de carga de la nómina en Excel (RF-04, T1112-A). Una nómina real tiene decenas de filas
// (el colegio tiene unos 400 estudiantes, RNF-06): los límites dejan margen sin permitir abusos.
export const LIMITES_CARGA = {
  /** Tamaño máximo del archivo subido. */
  bytes: 2 * 1024 * 1024,
  /** Filas de datos por hoja, sin contar el encabezado. */
  filas: 1000,
  /** Columnas por fila: una nómina tiene unas pocas (cédula, nombres, apellidos, representante...). */
  columnas: 30,
  hojas: 5,
  /** Archivos dentro del ZIP: un .xlsx sencillo tiene alrededor de 10. */
  entradasZip: 100,
  /** Suma de lo que ocupa todo el contenido descomprimido (defensa contra bombas ZIP). */
  descomprimidoTotal: 25 * 1024 * 1024,
  /** Proporción máxima entre lo descomprimido y lo comprimido de una parte grande. */
  razonCompresion: 100,
  longitudNombre: 255,
} as const;

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
