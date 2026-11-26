import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { IsInt, IsObject, IsString, Length, Min } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { PONDERACIONES_OFICIALES, validarPonderaciones, type PonderacionesCalificacion } from '../../../../../packages/calculo-notas/src/index';
import { Roles } from '../../../src/autenticacion/guardia-jwt';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';

// Implementación de referencia de los parámetros del colegio (RNF-10) que cumple la suite de parámetros (T1125-A).
// Guarda en memoria y no forma parte del servicio; muestra cómo:
//  - dejar cambiar un parámetro solo al administrador;
//  - rechazar ponderaciones que no sumen 100 % (con el mismo validador del paquete compartido calculo-notas);
//  - rechazar una versión vieja (409) para no pisar el cambio de otro administrador;
//  - hacer que las notas usen las ponderaciones vigentes: el módulo de calificaciones las lee de aquí.

export const CLAVE_PONDERACIONES = 'ponderaciones_calificaciones';

export interface Parametro {
  id: string;
  clave: string;
  valor: Record<string, unknown>;
  version: number;
}

class SolicitudParametro {
  @IsString({ message: 'clave debe ser texto' }) @Length(1, 100, { message: 'clave va de 1 a 100 caracteres' }) clave: string;
  @IsObject({ message: 'valor debe ser un objeto' }) valor: Record<string, unknown>;
  @IsInt({ message: 'version debe ser un entero' }) @Min(0, { message: 'version no puede ser negativa' }) version: number;
}

@Injectable()
export class AlmacenParametrosReferencia {
  readonly parametros = new Map<string, Parametro>([
    [CLAVE_PONDERACIONES, { id: randomUUID(), clave: CLAVE_PONDERACIONES, valor: { ...PONDERACIONES_OFICIALES, minimoAprobacion: 7 }, version: 1 }],
  ]);

  /** Ponderaciones vigentes de la nota final. */
  ponderaciones(): PonderacionesCalificacion {
    const { aportes, proyecto, examen } = (this.parametros.get(CLAVE_PONDERACIONES) as Parametro).valor as Record<keyof PonderacionesCalificacion, number>;
    return { aportes, proyecto, examen };
  }
}

@Controller()
class ControladorParametrosReferencia {
  constructor(private readonly almacen: AlmacenParametrosReferencia) {}

  @Get('parametros')
  listarParametros(): Parametro[] {
    return [...this.almacen.parametros.values()];
  }

  @Put('parametros')
  @Roles('ADMIN')
  actualizarParametro(@Body() solicitud: SolicitudParametro): Parametro {
    const actual = this.almacen.parametros.get(solicitud.clave);
    if (!actual) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El parámetro no existe.');
    }
    if (solicitud.clave === CLAVE_PONDERACIONES) {
      const errores = validarPonderaciones(solicitud.valor);
      const minimo = solicitud.valor.minimoAprobacion;
      if (minimo !== undefined && (typeof minimo !== 'number' || !Number.isFinite(minimo) || minimo < 1 || minimo > 10)) {
        errores.push('minimoAprobacion debe ser una nota de 1 a 10');
      }
      if (errores.length > 0) {
        throw new ExcepcionApi(400, 'DATOS_INVALIDOS', errores.join('; '));
      }
    }
    if (solicitud.version !== actual.version) {
      throw new ExcepcionApi(409, 'CONFLICTO_VERSION', 'El parámetro cambió mientras lo editabas.');
    }
    const nuevo: Parametro = { ...actual, valor: { ...actual.valor, ...solicitud.valor }, version: actual.version + 1 };
    this.almacen.parametros.set(nuevo.clave, nuevo);
    return nuevo;
  }
}

@Module({
  providers: [AlmacenParametrosReferencia],
  controllers: [ControladorParametrosReferencia],
  exports: [AlmacenParametrosReferencia],
})
export class ModuloParametrosReferencia {}
