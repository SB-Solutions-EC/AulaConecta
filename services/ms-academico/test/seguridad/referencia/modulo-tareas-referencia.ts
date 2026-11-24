import { Body, Controller, Get, Module, Param, Post, Put, Query } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { Roles, UsuarioActual } from '../../../src/autenticacion/guardia-jwt';
import { UsuarioToken } from '../../../src/autenticacion/verificador-jwt';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { EnlaceSeguro, FechaCalendario, Identificador, Opcional, TextoLibre } from '../../../src/comun/validadores';
import { AlmacenReferencia, Asignacion, ModuloMatriculaReferencia } from './modulo-matricula-referencia';
import { AlmacenConfiguracionReferencia, ModuloReferencia } from './modulo-referencia';

// Implementación de referencia de tareas y entregas (RF-19, RF-20) que cumple la suite de autorización
// y saneamiento de texto (T1119-A). Guarda en memoria y no forma parte del servicio; muestra cómo:
//  - dejar crear tareas y calificar entregas solo al docente de esa asignación (decidido con el token);
//  - guardar el texto LITERAL con @TextoLibre (la PWA lo muestra como texto, nunca como HTML) y aceptar
//    solo enlaces http(s) con @EnlaceSeguro, para que ningún vínculo ejecute código;
//  - mostrar las tareas al curso y la nota de cada entrega solo a su estudiante y a su representante.

const TIPOS = ['TAREA', 'PRUEBA', 'PROYECTO'] as const;
/** Opcional que también admite null explícito (el contrato lo permite en estos campos). */
const SiHayValor = (): PropertyDecorator => ValidateIf((_objeto: object, valor: unknown) => valor !== undefined && valor !== null);

class SolicitudTarea {
  @Opcional() @Identificador() id?: string;
  @Identificador() asignacionId: string;
  @Identificador() periodoId: string;
  @IsIn(TIPOS, { message: 'tipo debe ser TAREA, PRUEBA o PROYECTO' }) tipo: (typeof TIPOS)[number];
  @SiHayValor() @IsInt({ message: 'bloque debe ser 1 o 2' }) @Min(1, { message: 'bloque debe ser 1 o 2' }) @Max(2, { message: 'bloque debe ser 1 o 2' })
  bloque?: number | null;
  @TextoLibre(150, { minimo: 2 }) titulo: string;
  @SiHayValor() @TextoLibre(2000, { multilinea: true }) descripcion?: string | null;
  @FechaCalendario() fechaEntrega: string;
  @SiHayValor() @EnlaceSeguro() enlaceRecurso?: string | null;
}

class FiltroTareas {
  @Identificador() asignacionId: string;
}

class ParametroTarea {
  @Identificador() id: string;
}

class SolicitudEntrega {
  @Opcional() @Identificador() id?: string;
  @Identificador() matriculaId: string;
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'nota debe ser un número' })
  @Min(0, { message: 'nota debe estar entre 0 y 10' })
  @Max(10, { message: 'nota debe estar entre 0 y 10' })
  nota: number;
  @SiHayValor() @TextoLibre(1000, { multilinea: true }) retroalimentacion?: string | null;
  @IsInt({ message: 'version debe ser un entero' }) @Min(0, { message: 'version no puede ser negativa' }) version: number;
}

interface Tarea {
  id: string;
  asignacionId: string;
  periodoId: string;
  tipo: (typeof TIPOS)[number];
  bloque: number | null;
  titulo: string;
  descripcion: string | null;
  fechaEntrega: string;
  enlaceRecurso: string | null;
  version: number;
}

interface Entrega {
  id: string;
  tareaId: string;
  matriculaId: string;
  nota: number;
  retroalimentacion: string | null;
  version: number;
}

const denegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');

@Controller()
class ControladorTareasReferencia {
  private readonly tareas = new Map<string, Tarea>();
  private readonly entregas = new Map<string, Entrega>();

  constructor(
    private readonly almacen: AlmacenReferencia,
    private readonly configuracion: AlmacenConfiguracionReferencia,
  ) {}

  private esDocenteDe(usuario: UsuarioToken, asignacion: Asignacion | undefined): boolean {
    return (
      asignacion !== undefined &&
      usuario.roles.includes('DOCENTE') &&
      this.almacen.personasDe(usuario.id, 'DOCENTE').some((p) => p.id === asignacion.docenteId)
    );
  }

  /** Matrículas propias (estudiante) o de sus representados (representante). */
  private matriculasPropias(usuario: UsuarioToken): { id: string; cursoId: string }[] {
    const estudiantes = new Set<string>();
    if (usuario.roles.includes('ESTUDIANTE')) {
      this.almacen.personasDe(usuario.id, 'ESTUDIANTE').forEach((p) => estudiantes.add(p.id));
    }
    if (usuario.roles.includes('REPRESENTANTE')) {
      const propias = new Set(this.almacen.personasDe(usuario.id, 'REPRESENTANTE').map((p) => p.id));
      this.almacen.representaciones.filter((r) => propias.has(r.representanteId)).forEach((r) => estudiantes.add(r.estudianteId));
    }
    return this.almacen.matriculas.filter((m) => estudiantes.has(m.estudianteId));
  }

  /** La tarea si quien consulta es su docente o alguien del curso; si no (o no existe), el mismo 403. */
  private tareaVisible(usuario: UsuarioToken, id: string): { tarea: Tarea; docente: boolean } {
    const tarea = this.tareas.get(id);
    const asignacion = tarea ? this.almacen.asignaciones.get(tarea.asignacionId) : undefined;
    if (!tarea || !asignacion) {
      throw denegado();
    }
    if (this.esDocenteDe(usuario, asignacion)) {
      return { tarea, docente: true };
    }
    if (this.matriculasPropias(usuario).some((m) => m.cursoId === asignacion.cursoId)) {
      return { tarea, docente: false };
    }
    throw denegado();
  }

  /** RF-19: solo el docente de la asignación, con la fecha dentro del trimestre del año lectivo del curso. */
  @Post('tareas')
  @Roles('DOCENTE')
  crearTarea(@UsuarioActual() usuario: UsuarioToken, @Body() solicitud: SolicitudTarea): Tarea {
    const asignacion = this.almacen.asignaciones.get(solicitud.asignacionId);
    if (!asignacion || !this.esDocenteDe(usuario, asignacion)) {
      throw denegado();
    }
    const periodo = this.configuracion.periodos.buscar(solicitud.periodoId);
    const curso = this.configuracion.cursos.buscar(asignacion.cursoId);
    if (!periodo || !curso || periodo.anioLectivoId !== curso.anioLectivoId) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El trimestre no es del año lectivo del curso.');
    }
    if (solicitud.fechaEntrega < String(periodo.inicio) || solicitud.fechaEntrega > String(periodo.fin)) {
      throw new ExcepcionApi(400, 'FUERA_DEL_TRIMESTRE', 'La fecha de entrega debe estar dentro del trimestre.');
    }
    const id = solicitud.id ?? randomUUID();
    if (this.tareas.has(id)) {
      throw new ExcepcionApi(409, 'CONFLICTO', 'La tarea ya existe.');
    }
    const tarea: Tarea = {
      id,
      asignacionId: asignacion.id,
      periodoId: solicitud.periodoId,
      tipo: solicitud.tipo,
      bloque: solicitud.bloque ?? null,
      // Literal: el texto no se transforma ni se "limpia" de HTML; quien lo muestra lo escapa
      titulo: solicitud.titulo,
      descripcion: solicitud.descripcion ?? null,
      fechaEntrega: solicitud.fechaEntrega,
      enlaceRecurso: solicitud.enlaceRecurso ?? null,
      version: 0,
    };
    this.tareas.set(id, tarea);
    return tarea;
  }

  /** Calendario: el docente de la asignación y los estudiantes y representantes del curso. */
  @Get('tareas')
  @Roles('DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE')
  listarTareas(@UsuarioActual() usuario: UsuarioToken, @Query() { asignacionId }: FiltroTareas): Tarea[] {
    const asignacion = this.almacen.asignaciones.get(asignacionId);
    const delCurso = asignacion !== undefined && this.matriculasPropias(usuario).some((m) => m.cursoId === asignacion.cursoId);
    if (!this.esDocenteDe(usuario, asignacion) && !delCurso) {
      throw denegado();
    }
    return [...this.tareas.values()].filter((t) => t.asignacionId === asignacionId);
  }

  /** RF-20: nota y retroalimentación, solo del docente de la tarea. */
  @Put('tareas/:id/entregas')
  @Roles('DOCENTE')
  calificarEntrega(@UsuarioActual() usuario: UsuarioToken, @Param() { id }: ParametroTarea, @Body() solicitud: SolicitudEntrega): Entrega {
    const tarea = this.tareas.get(id);
    const asignacion = tarea ? this.almacen.asignaciones.get(tarea.asignacionId) : undefined;
    if (!tarea || !asignacion || !this.esDocenteDe(usuario, asignacion)) {
      throw denegado();
    }
    const matricula = this.almacen.matriculas.find((m) => m.id === solicitud.matriculaId);
    if (!matricula || matricula.cursoId !== asignacion.cursoId) {
      throw new ExcepcionApi(400, 'MATRICULA_FUERA_DEL_CURSO', 'El estudiante no está matriculado en el curso de esta tarea.');
    }
    const clave = `${tarea.id}:${matricula.id}`;
    const anterior = this.entregas.get(clave);
    if (solicitud.version !== (anterior ? anterior.version : 0)) {
      throw new ExcepcionApi(409, 'CONFLICTO_VERSION', 'La entrega cambió mientras la editabas.');
    }
    const entrega: Entrega = {
      id: anterior?.id ?? solicitud.id ?? randomUUID(),
      tareaId: tarea.id,
      matriculaId: matricula.id,
      nota: solicitud.nota,
      retroalimentacion: solicitud.retroalimentacion ?? null,
      version: (anterior?.version ?? 0) + 1,
    };
    this.entregas.set(clave, entrega);
    return entrega;
  }

  /** El docente ve todas; el estudiante y el representante, solo las suyas. */
  @Get('tareas/:id/entregas')
  @Roles('DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE')
  listarEntregas(@UsuarioActual() usuario: UsuarioToken, @Param() { id }: ParametroTarea): Entrega[] {
    const { tarea, docente } = this.tareaVisible(usuario, id);
    const propias = new Set(this.matriculasPropias(usuario).map((m) => m.id));
    return [...this.entregas.values()].filter((e) => e.tareaId === tarea.id && (docente || propias.has(e.matriculaId)));
  }
}

@Module({
  imports: [ModuloReferencia, ModuloMatriculaReferencia],
  controllers: [ControladorTareasReferencia],
})
export class ModuloTareasReferencia {}
