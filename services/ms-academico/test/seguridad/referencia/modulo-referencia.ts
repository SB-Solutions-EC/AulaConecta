import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IsBoolean, IsString, Matches } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { FechaCalendario, Identificador, Opcional, TextoSeguro } from '../../../src/comun/validadores';
import { GuardiaReferencia, Roles } from './guardia-referencia';

// Implementación de referencia de RF-06 y RF-07 que cumple todas las pruebas de seguridad.
// Sirve para probar la propia suite y como ejemplo de DTOs para los endpoints reales;
// guarda en memoria y no forma parte del servicio.

class SolicitudAnioLectivo {
  @Opcional() @Identificador() id?: string;
  @IsString() @Matches(/^\d{4}-\d{4}$/, { message: 'nombre debe tener la forma 2026-2027' }) nombre: string;
  @FechaCalendario() inicio: string;
  @FechaCalendario() fin: string;
  @Opcional() @IsBoolean({ message: 'activo debe ser verdadero o falso' }) activo?: boolean;
}

class SolicitudCurso {
  @Opcional() @Identificador() id?: string;
  @Identificador() anioLectivoId: string;
  @TextoSeguro(40) nivel: string;
  @TextoSeguro(2) @Matches(/^[A-Z]{1,2}$/, { message: 'paralelo debe ser una o dos letras mayúsculas' }) paralelo: string;
}

class SolicitudMateria {
  @Opcional() @Identificador() id?: string;
  @TextoSeguro(80, 2) nombre: string;
  @TextoSeguro(80, 2) area: string;
}

class FiltroCursos {
  @Opcional() @Identificador() anioLectivoId?: string;
}

type Registro = Record<string, unknown> & { id: string };

const conflicto = (mensaje: string): ExcepcionApi => new ExcepcionApi(409, 'CONFLICTO', mensaje);

class Tabla {
  private readonly filas = new Map<string, Registro>();

  todas(): Registro[] {
    return [...this.filas.values()];
  }

  insertar(id: string | undefined, datos: Record<string, unknown>, repetido: (fila: Registro) => boolean): Registro {
    const fila: Registro = { ...datos, id: id ?? randomUUID(), version: 0 };
    if (this.filas.has(fila.id) || this.todas().some(repetido)) {
      throw conflicto('El registro ya existe.');
    }
    this.filas.set(fila.id, fila);
    return fila;
  }

  existe(id: string): boolean {
    return this.filas.has(id);
  }
}

@Controller()
class ControladorReferencia {
  private readonly anios = new Tabla();
  private readonly cursos = new Tabla();
  private readonly materias = new Tabla();

  @Get('anios-lectivos')
  listarAnios(): Registro[] {
    return this.anios.todas();
  }

  @Post('anios-lectivos')
  @Roles('ADMIN')
  crearAnio(@Body() { id, nombre, inicio, fin, activo }: SolicitudAnioLectivo): Registro {
    if (fin <= inicio) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'La fecha de fin debe ser posterior al inicio.');
    }
    return this.anios.insertar(id, { nombre, inicio, fin, activo: activo ?? true }, (fila) => fila.nombre === nombre);
  }

  @Get('cursos')
  listarCursos(@Query() { anioLectivoId }: FiltroCursos): Registro[] {
    return this.cursos.todas().filter((curso) => !anioLectivoId || curso.anioLectivoId === anioLectivoId);
  }

  @Post('cursos')
  @Roles('ADMIN')
  crearCurso(@Body() { id, anioLectivoId, nivel, paralelo }: SolicitudCurso): Registro {
    if (!this.anios.existe(anioLectivoId)) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El año lectivo no existe.');
    }
    const repetido = (fila: Registro): boolean =>
      fila.anioLectivoId === anioLectivoId && fila.nivel === nivel && fila.paralelo === paralelo;
    return this.cursos.insertar(id, { anioLectivoId, nivel, paralelo }, repetido);
  }

  @Get('materias')
  listarMaterias(): Registro[] {
    return this.materias.todas();
  }

  @Post('materias')
  @Roles('ADMIN')
  crearMateria(@Body() { id, nombre, area }: SolicitudMateria): Registro {
    const repetido = (fila: Registro): boolean => String(fila.nombre).toLowerCase() === nombre.toLowerCase();
    return this.materias.insertar(id, { nombre, area }, repetido);
  }
}

@Module({
  controllers: [ControladorReferencia],
  providers: [{ provide: APP_GUARD, useClass: GuardiaReferencia }],
})
export class ModuloReferencia {}
