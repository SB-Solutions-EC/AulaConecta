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
