import { randomInt } from 'node:crypto';

// Datos de personas generados en cada ejecución: nunca quedan cédulas ni nombres fijos en el repositorio
// (Gitleaks marca cualquier número con forma de cédula, ver .gitleaks.toml).

/** Dígito verificador del módulo 10 del Registro Civil para los 9 primeros dígitos. */
export function digitoVerificador(nueveDigitos: string): number {
  const suma = [...nueveDigitos].reduce((total, caracter, posicion) => {
    const producto = Number(caracter) * (posicion % 2 === 0 ? 2 : 1);
    return total + (producto > 9 ? producto - 9 : producto);
  }, 0);
  return (10 - (suma % 10)) % 10;
}

/** Cédula con formato y verificador válidos, generada al azar para una base de pruebas efímera. */
export function cedulaFicticia(): string {
  const provincia = String(randomInt(1, 25)).padStart(2, '0');
  const base = `${provincia}${randomInt(0, 6)}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
  return `${base}${digitoVerificador(base)}`;
}

/** La misma cédula con el verificador equivocado. */
export function conVerificadorErroneo(cedula: string): string {
  return `${cedula.slice(0, 9)}${(Number(cedula[9]) + 1) % 10}`;
}

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

/** Palabra al azar con mayúscula inicial, para nombres que no se repiten entre ejecuciones. */
export function palabraFicticia(longitud = 8): string {
  const palabra = Array.from({ length: longitud }, () => LETRAS[randomInt(0, LETRAS.length)]).join('');
  return palabra[0].toUpperCase() + palabra.slice(1);
}
