import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsISO8601, IsString, IsUUID, Length, Matches, ValidateIf, ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

// Letras (con tildes y ñ), números, espacios y . , ' ( ) / ° - –. Sin < > ; " ` \ = ni caracteres de control.
export const PATRON_TEXTO_SEGURO = /^[\p{L}\p{N}](?:[\p{L}\p{N} .,'()/°–-]*[\p{L}\p{N}.)°])?$/u;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function normalizar({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/ {2,}/g, ' ') : value;
}

/**
 * Texto corto escrito por personas (nombre de materia, nivel, paralelo...).
 * Recorta espacios, exige entre `minimo` y `maximo` caracteres y solo admite el juego seguro.
 */
export function TextoSeguro(maximo: number, minimo = 1): PropertyDecorator {
  return applyDecorators(
    Transform(normalizar),
    IsString({ message: '$property debe ser texto' }),
    Length(minimo, maximo, { message: `$property debe tener entre ${minimo} y ${maximo} caracteres` }),
    Matches(PATRON_TEXTO_SEGURO, { message: '$property contiene caracteres no permitidos' }),
  );
}

/** Fecha de calendario AAAA-MM-DD que existe (rechaza 2026-02-30 y fechas con hora). */
export function FechaCalendario(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: '$property debe ser una fecha AAAA-MM-DD' }),
    Matches(PATRON_FECHA, { message: '$property debe ser una fecha AAAA-MM-DD' }),
    IsISO8601({ strict: true }, { message: '$property no es una fecha válida' }),
  );
}

/**
 * Campo que se puede omitir. A diferencia de @IsOptional, un null explícito sí se valida
 * (y se rechaza): omitir un campo no es lo mismo que enviarlo vacío.
 */
export function Opcional(): PropertyDecorator {
  return ValidateIf((_objeto: object, valor: unknown) => valor !== undefined);
}

/** UUID en forma canónica (lo genera la PWA sin conexión o el servidor). */
export function Identificador(): PropertyDecorator {
  return IsUUID('all', { message: '$property debe ser un UUID' });
}

/**
 * Cédula de identidad ecuatoriana: 10 dígitos, provincia 01 a 24 o 30 (exterior), tercer dígito de 0 a 5
 * (persona natural) y dígito verificador con el módulo 10 del Registro Civil.
 */
export function esCedulaValida(valor: unknown): boolean {
  if (typeof valor !== 'string' || !/^\d{10}$/.test(valor)) {
    return false;
  }
  const provincia = Number(valor.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30) || Number(valor[2]) > 5) {
    return false;
  }
  const suma = [...valor.slice(0, 9)].reduce((total, caracter, posicion) => {
    const producto = Number(caracter) * (posicion % 2 === 0 ? 2 : 1);
    return total + (producto > 9 ? producto - 9 : producto);
  }, 0);
  return (10 - (suma % 10)) % 10 === Number(valor[9]);
}

/** La cédula solo se usa para el registro y la clave inicial: nunca vuelve en una respuesta (RNF-04). */
export function Cedula(opciones?: ValidationOptions): PropertyDecorator {
  return (objetivo: object, propiedad: string | symbol) =>
    registerDecorator({
      name: 'cedula',
      target: objetivo.constructor,
      propertyName: String(propiedad),
      options: { message: (args: ValidationArguments) => `${args.property} no es una cédula válida`, ...opciones },
      validator: { validate: esCedulaValida },
    });
}

// ---------------- Texto libre y enlaces (tareas, retroalimentación: T1119-A) ----------------

/**
 * Caracteres que no escribe una persona y sirven para engañar o romper la salida: control C0 y C1, DEL,
 * cambios de dirección U+202A a U+202E y U+2066 a U+2069 (con U+202E, el nombre "Materia" + U+202E +
 * "gpj.exe" se ve en pantalla como "Materiaexe.jpg"), invisibles de ancho cero y la marca de orden de bytes.
 */
const RANGOS_PROHIBIDOS: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
];
const SALTO_DE_LINEA = 0x0a;
const RETORNO_DE_CARRO = 0x0d;

/** Sin expresiones regulares: SonarQube (S6324) no admite caracteres de control dentro de una regex. */
function caracterProhibido(codigo: number, multilinea: boolean): boolean {
  if (codigo === SALTO_DE_LINEA || codigo === RETORNO_DE_CARRO) {
    return !multilinea;
  }
  return RANGOS_PROHIBIDOS.some(([desde, hasta]) => codigo >= desde && codigo <= hasta);
}

export function esTextoLibreValido(valor: unknown, multilinea = false): boolean {
  if (typeof valor !== 'string') {
    return false;
  }
  // El tabulador (0x09) se admite; los saltos de línea solo con multilinea
  for (const caracter of valor) {
    if (caracterProhibido(caracter.codePointAt(0) ?? 0, multilinea)) {
      return false;
    }
  }
  return true;
}

function normalizarTextoLibre({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\r\n?/g, '\n').trim() : value;
}

/**
 * Texto que escribe una persona y se guarda LITERAL (título de una tarea, retroalimentación): admite
 * signos como `: ¿? ¡! # < >`, porque la PWA lo muestra como texto y nunca como HTML (React lo escapa).
 * Rechaza caracteres de control, de dirección e invisibles, y saltos de línea salvo con `multilinea`.
 */
export function TextoLibre(maximo: number, opciones: { minimo?: number; multilinea?: boolean } = {}): PropertyDecorator {
  const { minimo = 1, multilinea = false } = opciones;
  return applyDecorators(
    Transform(normalizarTextoLibre),
    IsString({ message: '$property debe ser texto' }),
    Length(minimo, maximo, { message: `$property debe tener entre ${minimo} y ${maximo} caracteres` }),
    (objetivo: object, propiedad: string | symbol) =>
      registerDecorator({
        name: 'textoLibre',
        target: objetivo.constructor,
        propertyName: String(propiedad),
        options: { message: (args: ValidationArguments) => `${args.property} contiene caracteres no permitidos` },
        validator: { validate: (valor: unknown) => esTextoLibreValido(valor, multilinea) },
      }),
  );
}

/** Solo https:// o http://, sin usuario ni clave, sin espacios ni caracteres de control. */
export function esEnlaceSeguro(valor: unknown): boolean {
  if (typeof valor !== 'string' || valor.length > 255 || /\s/.test(valor) || !esTextoLibreValido(valor) || !/^https?:\/\//i.test(valor)) {
    return false;
  }
  try {
    const url = new URL(valor);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/**
 * Enlace que la PWA convierte en un vínculo: `javascript:`, `data:`, `vbscript:` o `file:` ejecutarían
 * código o abrirían archivos del equipo al hacer clic (XSS almacenado).
 */
export function EnlaceSeguro(): PropertyDecorator {
  return (objetivo: object, propiedad: string | symbol) =>
    registerDecorator({
      name: 'enlaceSeguro',
      target: objetivo.constructor,
      propertyName: String(propiedad),
      options: { message: (args: ValidationArguments) => `${args.property} debe ser una dirección https:// o http://` },
      validator: { validate: esEnlaceSeguro },
    });
}
