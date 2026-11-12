import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsISO8601, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';

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
