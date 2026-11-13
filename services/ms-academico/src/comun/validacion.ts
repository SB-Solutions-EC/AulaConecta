import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ExcepcionApi } from './excepcion-api';

// Solo se nombra un campo extra en la respuesta si su nombre es inofensivo.
const NOMBRE_CAMPO_LEGIBLE = /^[A-Za-z][A-Za-z0-9]{0,40}$/;

function describir(error: ValidationError, prefijo: string): string[] {
  const ruta = prefijo ? `${prefijo}.${error.property}` : error.property;
  const propios = Object.entries(error.constraints ?? {}).map(([regla, mensaje]) => {
    if (regla === 'whitelistValidation') {
      return NOMBRE_CAMPO_LEGIBLE.test(error.property) ? `${ruta}: campo no permitido` : 'campo no permitido';
    }
    // Los mensajes empiezan con el nombre del campo; en campos anidados se antepone la ruta
    return prefijo && mensaje.startsWith(error.property) ? `${prefijo}.${mensaje}` : mensaje;
  });
  const hijos = (error.children ?? []).flatMap((hijo) => describir(hijo, ruta));
  return [...propios, ...hijos];
}

export function detallesDeValidacion(errores: ValidationError[]): string[] {
  return [...new Set(errores.flatMap((error) => describir(error, '')))];
}

// Pipe global: todo cuerpo y consulta pasa por aquí antes de llegar a un controlador.
export function crearPipeValidacion(): ValidationPipe {
  return new ValidationPipe({
    // Campos que el DTO no declara: se rechazan (evita asignación masiva de version, rol, etc.)
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    // Convierte el JSON en la clase del DTO; sin conversión implícita de tipos ("true" no es booleano)
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    // El valor rechazado no vuelve en la respuesta
    validationError: { target: false, value: false },
    exceptionFactory: (errores) =>
      new ExcepcionApi(400, 'DATOS_INVALIDOS', 'Los datos enviados no son válidos.', detallesDeValidacion(errores)),
  });
}
