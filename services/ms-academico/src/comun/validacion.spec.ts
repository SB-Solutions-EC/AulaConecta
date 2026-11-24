import { ArgumentMetadata, ValidationError } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ExcepcionApi } from './excepcion-api';
import { crearPipeValidacion, detallesDeValidacion } from './validacion';
import { FechaCalendario, Identificador, Opcional, TextoSeguro } from './validadores';

class Paralelo {
  @TextoSeguro(2) letra: string;
}

class Solicitud {
  @Opcional() @Identificador() id?: string;
  @TextoSeguro(80) nombre: string;
  @FechaCalendario() inicio: string;
  @ValidateNested() @Type(() => Paralelo) paralelo: Paralelo;
}

const pipe = crearPipeValidacion();
const metadatos: ArgumentMetadata = { type: 'body', metatype: Solicitud };
const valido = { nombre: 'Educación Cultural y Artística', inicio: '2026-09-01', paralelo: { letra: 'A' } };

async function rechazo(cuerpo: unknown): Promise<ExcepcionApi> {
  const error: unknown = await pipe.transform(cuerpo, metadatos).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ExcepcionApi);
  return error as ExcepcionApi;
}

describe('crearPipeValidacion', () => {
  it('deja pasar un cuerpo válido y normaliza los espacios del texto', async () => {
    const resultado = (await pipe.transform({ ...valido, nombre: '  Lengua   y Literatura ' }, metadatos)) as Solicitud;

    expect(resultado).toBeInstanceOf(Solicitud);
    expect(resultado.nombre).toBe('Lengua y Literatura');
  });

  it('responde DATOS_INVALIDOS con un detalle por regla incumplida, incluidos los campos anidados', async () => {
    const error = await rechazo({ ...valido, inicio: '2026-02-30', paralelo: { letra: '<b>' } });

    expect(error.getStatus()).toBe(400);
    expect(error.codigo).toBe('DATOS_INVALIDOS');
    expect(error.detalles).toEqual([
      'inicio no es una fecha válida',
      'paralelo.letra debe tener entre 1 y 2 caracteres',
      'paralelo.letra contiene caracteres no permitidos',
    ]);
  });

  it('rechaza campos que el DTO no declara y solo los nombra si el nombre es inofensivo', async () => {
    const error = await rechazo({ ...valido, version: 9, '<img src=x>': 1 });

    expect(error.detalles).toEqual(['version: campo no permitido', 'campo no permitido']);
  });

  it('un null explícito en un campo opcional se valida (omitirlo no es lo mismo)', async () => {
    await expect(pipe.transform({ ...valido }, metadatos)).resolves.toBeInstanceOf(Solicitud);
    expect((await rechazo({ ...valido, id: null })).detalles).toEqual(['id debe ser un UUID']);
  });

  it('no convierte tipos por su cuenta', async () => {
    expect((await rechazo({ ...valido, nombre: 123 })).detalles).toContain('nombre debe ser texto');
  });
});

describe('detallesDeValidacion', () => {
  it('quita los mensajes repetidos', () => {
    const repetido: ValidationError = { property: 'nombre', constraints: { a: 'nombre falta', b: 'nombre falta' }, children: [] };

    expect(detallesDeValidacion([repetido, repetido])).toEqual(['nombre falta']);
  });
});
