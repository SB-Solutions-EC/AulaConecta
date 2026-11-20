import { Body, Controller, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, Min, ValidateIf } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { Roles, UsuarioActual } from '../../../src/autenticacion/guardia-jwt';
import { UsuarioToken } from '../../../src/autenticacion/verificador-jwt';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { FechaCalendario, Identificador, Opcional, TextoLibre } from '../../../src/comun/validadores';
import { AlmacenReferencia, Asignacion, ModuloMatriculaReferencia } from './modulo-matricula-referencia';
import { AlmacenConfiguracionReferencia, ModuloReferencia } from './modulo-referencia';

// Implementación de referencia de asistencia y justificación (RF-21, CU-14, CU-19) que cumple la suite
// de T1123-A. Guarda en memoria y no forma parte del servicio. Regla acordada con el equipo:
//  - el DOCENTE de esa materia en ese curso registra la asistencia y es el ÚNICO que aprueba una
//    justificación (estado JUSTIFICADA);
//  - el ESTUDIANTE dueño de la falta solo la solicita (POST /asistencias/{id}/justificacion);
//  - el representante, la secretaría, el administrador y los demás docentes no la cambian.

const ESTADOS = ['PRESENTE', 'FALTA', 'ATRASO', 'JUSTIFICADA'] as const;
type Estado = (typeof ESTADOS)[number];
const SiHayValor = (): PropertyDecorator => ValidateIf((_objeto: object, valor: unknown) => valor !== undefined && valor !== null);

class SolicitudAsistencia {
  @Opcional() @Identificador() id?: string;
  @Identificador() asignacionId: string;
  @Identificador() matriculaId: string;
  @FechaCalendario() fecha: string;
  @IsIn(ESTADOS, { message: 'estado debe ser PRESENTE, FALTA, ATRASO o JUSTIFICADA' }) estado: Estado;
  @SiHayValor() @TextoLibre(255, { minimo: 3, multilinea: true }) justificacion?: string | null;
  @Opcional() @IsBoolean({ message: 'confirmar debe ser verdadero o falso' }) confirmar?: boolean;
  @IsInt({ message: 'version debe ser un entero' }) @Min(0, { message: 'version no puede ser negativa' }) version: number;
}

class SolicitudJustificacion {
  @TextoLibre(255, { minimo: 3, multilinea: true }) motivo: string;
}

class FiltroAsistencias {
  @Opcional() @Identificador() asignacionId?: string;
  @Opcional() @Identificador() matriculaId?: string;
  @Opcional() @FechaCalendario() fecha?: string;
}

class ParametroAsistencia {
  @Identificador() id: string;
}

interface Asistencia {
  id: string;
  asignacionId: string;
  matriculaId: string;
  fecha: string;
  estado: Estado;
  justificacion: string | null;
  estadoJustificacion: 'SOLICITADA' | 'APROBADA' | null;
  version: number;
}

const denegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');

@Controller()
class ControladorAsistenciaReferencia {
  private readonly asistencias = new Map<string, Asistencia>();

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

  /** Matrículas propias del estudiante del token, o de los representados del representante. */
  private matriculasPropias(usuario: UsuarioToken, soloEstudiante = false): Set<string> {
    const estudiantes = new Set<string>();
    if (usuario.roles.includes('ESTUDIANTE')) {
      this.almacen.personasDe(usuario.id, 'ESTUDIANTE').forEach((p) => estudiantes.add(p.id));
    }
    if (!soloEstudiante && usuario.roles.includes('REPRESENTANTE')) {
      const propias = new Set(this.almacen.personasDe(usuario.id, 'REPRESENTANTE').map((p) => p.id));
      this.almacen.representaciones.filter((r) => propias.has(r.representanteId)).forEach((r) => estudiantes.add(r.estudianteId));
    }
    return new Set(this.almacen.matriculas.filter((m) => estudiantes.has(m.estudianteId)).map((m) => m.id));
  }

  private buscarPorClave(asignacionId: string, matriculaId: string, fecha: string): Asistencia | undefined {
    return [...this.asistencias.values()].find((a) => a.asignacionId === asignacionId && a.matriculaId === matriculaId && a.fecha === fecha);
  }

  /** RF-21: el docente registra; JUSTIFICADA solo la marca él y necesita un motivo. */
  @Put('asistencias')
  @Roles('DOCENTE')
  guardarAsistencia(@UsuarioActual() usuario: UsuarioToken, @Body() solicitud: SolicitudAsistencia): Asistencia {
    const asignacion = this.almacen.asignaciones.get(solicitud.asignacionId);
    if (!asignacion || !this.esDocenteDe(usuario, asignacion)) {
      throw denegado();
    }
    const matricula = this.almacen.matriculas.find((m) => m.id === solicitud.matriculaId);
    if (!matricula || matricula.cursoId !== asignacion.cursoId) {
      throw new ExcepcionApi(400, 'MATRICULA_FUERA_DEL_CURSO', 'El estudiante no está matriculado en el curso de esta asignación.');
    }
    const curso = this.configuracion.cursos.buscar(asignacion.cursoId);
    const anio = curso ? this.configuracion.anios.buscar(String(curso.anioLectivoId)) : undefined;
    if (!anio || solicitud.fecha < String(anio.inicio) || solicitud.fecha > String(anio.fin)) {
      throw new ExcepcionApi(400, 'FUERA_DEL_ANIO_LECTIVO', 'La fecha debe estar dentro del año lectivo.');
    }

    const anterior = this.buscarPorClave(asignacion.id, matricula.id, solicitud.fecha);
    if (solicitud.version !== (anterior ? anterior.version : 0)) {
      throw new ExcepcionApi(409, 'CONFLICTO_VERSION', 'La asistencia cambió mientras la editabas.');
    }
    // Excepción de RF-21: una falta ya justificada solo vuelve a FALTA si el docente lo confirma
    if (anterior?.estado === 'JUSTIFICADA' && solicitud.estado === 'FALTA' && solicitud.confirmar !== true) {
      throw new ExcepcionApi(409, 'CONFIRMACION_REQUERIDA', 'Esta falta ya estaba justificada: confirma que quieres marcarla de nuevo como falta.');
    }

    const motivo = solicitud.justificacion ?? anterior?.justificacion ?? null;
    if (solicitud.estado === 'JUSTIFICADA' && !motivo) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'La justificación necesita un motivo.');
    }
    let estadoJustificacion = anterior?.estadoJustificacion ?? null;
    if (solicitud.estado === 'JUSTIFICADA') {
      estadoJustificacion = 'APROBADA';
    } else if (estadoJustificacion === 'APROBADA') {
      estadoJustificacion = null;
    }

    const asistencia: Asistencia = {
      id: anterior?.id ?? solicitud.id ?? randomUUID(),
      asignacionId: asignacion.id,
      matriculaId: matricula.id,
      fecha: solicitud.fecha,
      estado: solicitud.estado,
      justificacion: motivo,
      estadoJustificacion,
      version: (anterior?.version ?? 0) + 1,
    };
    this.asistencias.set(asistencia.id, asistencia);
    return asistencia;
  }

  /** CU-19: solo el estudiante dueño de la falta pide la justificación; no cambia el estado. */
  @Post('asistencias/:id/justificacion')
  @HttpCode(200)
  @Roles('ESTUDIANTE')
  solicitarJustificacion(@UsuarioActual() usuario: UsuarioToken, @Param() { id }: ParametroAsistencia, @Body() { motivo }: SolicitudJustificacion): Asistencia {
    const asistencia = this.asistencias.get(id);
    // Ajena o inexistente: el mismo 403
    if (!asistencia || !this.matriculasPropias(usuario, true).has(asistencia.matriculaId)) {
      throw denegado();
    }
    if (asistencia.estado !== 'FALTA' && asistencia.estado !== 'ATRASO') {
      throw new ExcepcionApi(409, 'NADA_QUE_JUSTIFICAR', 'Solo se justifica una falta o un atraso.');
    }
    if (asistencia.estadoJustificacion === 'SOLICITADA') {
      throw new ExcepcionApi(409, 'SOLICITUD_PENDIENTE', 'Ya hay una solicitud de justificación pendiente.');
    }
    const actualizada: Asistencia = { ...asistencia, justificacion: motivo, estadoJustificacion: 'SOLICITADA', version: asistencia.version + 1 };
    this.asistencias.set(id, actualizada);
    return actualizada;
  }

  /** El docente ve sus asignaciones; el estudiante y el representante, solo lo suyo; la secretaría, nada. */
  @Get('asistencias')
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE')
  listarAsistencias(@UsuarioActual() usuario: UsuarioToken, @Query() filtro: FiltroAsistencias): Asistencia[] {
    const coincide = (a: Asistencia): boolean =>
      (!filtro.asignacionId || a.asignacionId === filtro.asignacionId) &&
      (!filtro.matriculaId || a.matriculaId === filtro.matriculaId) &&
      (!filtro.fecha || a.fecha === filtro.fecha);
    const todas = [...this.asistencias.values()];
    if (usuario.roles.includes('ADMIN')) {
      return todas.filter(coincide);
    }
    const propias = this.matriculasPropias(usuario);
    const asignacionPropia = (asignacionId: string): boolean => this.esDocenteDe(usuario, this.almacen.asignaciones.get(asignacionId));

    // Pedir lo ajeno responde 403 exista o no
    const matriculaPermitida = filtro.matriculaId !== undefined && propias.has(filtro.matriculaId);
    if (filtro.asignacionId && !asignacionPropia(filtro.asignacionId) && !matriculaPermitida) {
      throw denegado();
    }
    if (filtro.matriculaId && !matriculaPermitida && !(filtro.asignacionId && asignacionPropia(filtro.asignacionId))) {
      throw denegado();
    }
    return todas.filter((a) => coincide(a) && (asignacionPropia(a.asignacionId) || propias.has(a.matriculaId)));
  }
}

@Module({
  imports: [ModuloReferencia, ModuloMatriculaReferencia],
  controllers: [ControladorAsistenciaReferencia],
})
export class ModuloAsistenciaReferencia {}
