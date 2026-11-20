import { Body, Controller, Get, Module, Post, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, Matches, Max, Min, ValidateIf } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { calcularCalificacionInmediata } from '../../../../../packages/calculo-notas/src/index';
import { Roles, UsuarioActual } from '../../../src/autenticacion/guardia-jwt';
import { UsuarioToken } from '../../../src/autenticacion/verificador-jwt';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { Identificador, Opcional } from '../../../src/comun/validadores';
import { AlmacenReferencia, Asignacion, ModuloMatriculaReferencia } from './modulo-matricula-referencia';

// Implementación de referencia de asignaciones (RF-05) y calificaciones (RF-17, RF-18) que cumple la suite
// de exactitud y permisos (T1118-A). Guarda en memoria y no forma parte del servicio; muestra cómo:
//  - recalcular SIEMPRE en el servidor con el paquete compartido packages/calculo-notas, ignorando cualquier
//    nota final que mande el cliente;
//  - dejar calificar solo al docente asignado a esa materia en ese curso, decidido con el usuario del token;
//  - rechazar una versión vieja (409) para no pisar el cambio de otro docente o de otro dispositivo.

const MENSAJE_NOTA = 'debe ser una nota de 0 a 10';

/** Cada aporte: número de 0 a 10 (las celdas vacías se omiten del arreglo). El libro tiene 5 por bloque. */
function Aportes(): PropertyDecorator {
  return (objetivo: object, propiedad: string | symbol) => {
    IsArray({ message: '$property debe ser una lista de notas' })(objetivo, propiedad);
    ArrayMaxSize(5, { message: '$property admite 5 aportes como máximo' })(objetivo, propiedad);
    IsNumber({ allowNaN: false, allowInfinity: false }, { each: true, message: `cada aporte ${MENSAJE_NOTA}` })(objetivo, propiedad);
    Min(0, { each: true, message: `cada aporte ${MENSAJE_NOTA}` })(objetivo, propiedad);
    Max(10, { each: true, message: `cada aporte ${MENSAJE_NOTA}` })(objetivo, propiedad);
  };
}

function Nota(): PropertyDecorator {
  return (objetivo: object, propiedad: string | symbol) => {
    IsNumber({ allowNaN: false, allowInfinity: false }, { message: `$property ${MENSAJE_NOTA}` })(objetivo, propiedad);
    Min(0, { message: `$property ${MENSAJE_NOTA}` })(objetivo, propiedad);
    Max(10, { message: `$property ${MENSAJE_NOTA}` })(objetivo, propiedad);
  };
}

class SolicitudAsignacion {
  @Opcional() @Identificador() id?: string;
  @Identificador() docenteId: string;
  @Identificador() materiaId: string;
  @Identificador() cursoId: string;
}

class FiltroAsignaciones {
  @Opcional() @Identificador() docenteId?: string;
  @Opcional() @Identificador() cursoId?: string;
}

class SolicitudCalificacion {
  @Opcional() @Identificador() id?: string;
  @Identificador() asignacionId: string;
  @Identificador() matriculaId: string;
  @IsInt({ message: 'trimestre debe ser un entero' }) @Min(1, { message: 'trimestre va de 1 a 3' }) @Max(3, { message: 'trimestre va de 1 a 3' })
  trimestre: number;
  @Aportes() aportesBloque1: number[];
  @Aportes() aportesBloque2: number[];
  // El refuerzo es opcional: puede omitirse o llegar en null
  @ValidateIf((_objeto: object, valor: unknown) => valor !== undefined && valor !== null) @Nota() refuerzo?: number | null;
  @Nota() notaProyecto: number;
  @Nota() notaExamen: number;
  @IsInt({ message: 'version debe ser un entero' }) @Min(0, { message: 'version no puede ser negativa' }) version: number;
}

class FiltroCalificaciones {
  @Opcional() @Identificador() asignacionId?: string;
  @Opcional() @Identificador() matriculaId?: string;
  // Llega como texto en la consulta: sin conversión implícita
  @Opcional() @Matches(/^[1-3]$/, { message: 'trimestre va de 1 a 3' }) trimestre?: string;
}

interface Calificacion {
  id: string;
  asignacionId: string;
  matriculaId: string;
  trimestre: number;
  aportesBloque1: number[];
  aportesBloque2: number[];
  refuerzo: number | null;
  notaProyecto: number;
  notaExamen: number;
  notaFinal: number;
  cualitativo: string;
  version: number;
}

const denegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');

@Controller()
class ControladorCalificacionesReferencia {
  private readonly asignaciones: Map<string, Asignacion>;
  private readonly calificaciones = new Map<string, Calificacion>();

  constructor(private readonly almacen: AlmacenReferencia) {
    this.asignaciones = almacen.asignaciones;
  }

  /** Ids de persona docente de la cuenta del token: el docente se identifica solo con el token. */
  private docentesDe(usuario: UsuarioToken): Set<string> {
    if (!usuario.roles.includes('DOCENTE')) {
      return new Set();
    }
    return new Set(this.almacen.personasDe(usuario.id, 'DOCENTE').map((p) => p.id));
  }

  /** Matrículas cuyas notas puede ver un estudiante o un representante. */
  private matriculasPropias(usuario: UsuarioToken): Set<string> {
    const estudiantes = new Set<string>();
    if (usuario.roles.includes('ESTUDIANTE')) {
      this.almacen.personasDe(usuario.id, 'ESTUDIANTE').forEach((p) => estudiantes.add(p.id));
    }
    if (usuario.roles.includes('REPRESENTANTE')) {
      const propias = new Set(this.almacen.personasDe(usuario.id, 'REPRESENTANTE').map((p) => p.id));
      this.almacen.representaciones.filter((r) => propias.has(r.representanteId)).forEach((r) => estudiantes.add(r.estudianteId));
    }
    return new Set(this.almacen.matriculas.filter((m) => estudiantes.has(m.estudianteId)).map((m) => m.id));
  }

  @Post('asignaciones')
  @Roles('ADMIN')
  crearAsignacion(@Body() solicitud: SolicitudAsignacion): Asignacion {
    if (this.almacen.personas.get(solicitud.docenteId)?.tipo !== 'DOCENTE') {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El docente no existe.');
    }
    const repetida = [...this.asignaciones.values()].some(
      (a) => a.docenteId === solicitud.docenteId && a.materiaId === solicitud.materiaId && a.cursoId === solicitud.cursoId,
    );
    if (repetida) {
      throw new ExcepcionApi(409, 'CONFLICTO', 'La asignación ya existe.');
    }
    const asignacion: Asignacion = { ...solicitud, id: solicitud.id ?? randomUUID(), version: 0 };
    this.asignaciones.set(asignacion.id, asignacion);
    return asignacion;
  }

  @Get('asignaciones')
  @Roles('ADMIN', 'SECRETARIA', 'DOCENTE')
  listarAsignaciones(@UsuarioActual() usuario: UsuarioToken, @Query() { docenteId, cursoId }: FiltroAsignaciones): Asignacion[] {
    const personal = usuario.roles.includes('ADMIN') || usuario.roles.includes('SECRETARIA');
    const propios = this.docentesDe(usuario);
    return [...this.asignaciones.values()].filter(
      (a) => (personal || propios.has(a.docenteId)) && (!docenteId || a.docenteId === docenteId) && (!cursoId || a.cursoId === cursoId),
    );
  }

  /** RF-17 y RF-18: solo el docente de esa materia en ese curso registra los aportes; la nota la calcula el servidor. */
  @Put('calificaciones')
  @Roles('DOCENTE')
  guardarCalificacion(@UsuarioActual() usuario: UsuarioToken, @Body() solicitud: SolicitudCalificacion): Calificacion {
    const asignacion = this.asignaciones.get(solicitud.asignacionId);
    // Asignación ajena o inexistente: el mismo 403, para no revelar cuáles existen
    if (!asignacion || !this.docentesDe(usuario).has(asignacion.docenteId)) {
      throw denegado();
    }
    const matricula = this.almacen.matriculas.find((m) => m.id === solicitud.matriculaId);
    if (!matricula || matricula.cursoId !== asignacion.cursoId) {
      throw new ExcepcionApi(400, 'MATRICULA_FUERA_DEL_CURSO', 'El estudiante no está matriculado en el curso de esta asignación.');
    }

    const clave = `${asignacion.id}:${matricula.id}:${solicitud.trimestre}`;
    const anterior = this.calificaciones.get(clave);
    if (solicitud.version !== (anterior ? anterior.version : 0)) {
      throw new ExcepcionApi(409, 'CONFLICTO_VERSION', 'La calificación cambió mientras la editabas.');
    }

    // El mismo cálculo que la PWA y que el libro oficial (packages/calculo-notas)
    const resultado = calcularCalificacionInmediata(solicitud);
    if (resultado.notaFinal === null || resultado.cualitativo === null) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'Registra al menos un aporte o el refuerzo.');
    }
    const calificacion: Calificacion = {
      id: anterior?.id ?? solicitud.id ?? randomUUID(),
      asignacionId: asignacion.id,
      matriculaId: matricula.id,
      trimestre: solicitud.trimestre,
      aportesBloque1: solicitud.aportesBloque1,
      aportesBloque2: solicitud.aportesBloque2,
      refuerzo: solicitud.refuerzo ?? null,
      notaProyecto: solicitud.notaProyecto,
      notaExamen: solicitud.notaExamen,
      notaFinal: resultado.notaFinal,
      cualitativo: resultado.cualitativo,
      version: (anterior?.version ?? 0) + 1,
    };
    this.calificaciones.set(clave, calificacion);
    return calificacion;
  }

  /** El docente ve su asignación; el estudiante y el representante, solo lo suyo; la secretaría, nada. */
  @Get('calificaciones')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE')
  listarCalificaciones(@UsuarioActual() usuario: UsuarioToken, @Query() filtro: FiltroCalificaciones): Calificacion[] {
    const coincide = (c: Calificacion): boolean =>
      (!filtro.asignacionId || c.asignacionId === filtro.asignacionId) &&
      (!filtro.matriculaId || c.matriculaId === filtro.matriculaId) &&
      (!filtro.trimestre || c.trimestre === Number(filtro.trimestre));
    const todas = [...this.calificaciones.values()];

    if (usuario.roles.includes('ADMIN')) {
      return todas.filter(coincide);
    }
    const propias = this.matriculasPropias(usuario);
    const docentes = this.docentesDe(usuario);
    const asignacionPropia = (id: string): boolean => docentes.has(this.asignaciones.get(id)?.docenteId ?? '');

    // Pedir lo ajeno responde 403 exista o no
    if (filtro.asignacionId && !asignacionPropia(filtro.asignacionId)) {
      if (!filtro.matriculaId || !propias.has(filtro.matriculaId)) {
        throw denegado();
      }
    }
    if (filtro.matriculaId && !propias.has(filtro.matriculaId) && !filtro.asignacionId) {
      throw denegado();
    }
    return todas.filter((c) => coincide(c) && (asignacionPropia(c.asignacionId) || propias.has(c.matriculaId)));
  }
}

@Module({
  imports: [ModuloMatriculaReferencia],
  controllers: [ControladorCalificacionesReferencia],
})
export class ModuloCalificacionesReferencia {}
