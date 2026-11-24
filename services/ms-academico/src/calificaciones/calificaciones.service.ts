import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../base-datos/prisma.service';
import { ExcepcionApi, ExcepcionConflictoVersion } from '../comun/excepcion-api';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { calcularCalificacionInmediata, truncarADosDecimales } from '../generado/calculo-notas';
import { Prisma } from '../generado/prisma/client';
import { FiltroCalificaciones, SolicitudCalificacion } from './solicitudes.dto';

// Calificaciones (RF-17, RF-18, T1118-M). La nota final la calcula SIEMPRE el servidor con
// packages/calculo-notas, el mismo motor que usa la PWA: lo que el cliente calcula solo es una vista previa.

export interface Calificacion {
  id: string;
  asignacionId: string;
  matriculaId: string;
  trimestre: number;
  aportesBloque1: number[];
  aportesBloque2: number[];
  refuerzo: number | null;
  notaProyecto: number;
  notaExamen: number;
  notaFinal: number | null;
  cualitativo: string | null;
  version: number;
}

const conPeriodo = { periodo: { select: { numero: true } } } as const;
type FilaCalificacion = Prisma.CalificacionGetPayload<{ include: typeof conPeriodo }>;

const numero = (valor: Prisma.Decimal | null): number | null => (valor === null ? null : valor.toNumber());

function aRespuesta(fila: FilaCalificacion): Calificacion {
  return {
    id: fila.id,
    asignacionId: fila.asignacionId,
    matriculaId: fila.matriculaId,
    trimestre: fila.periodo.numero,
    aportesBloque1: fila.aportesBloque1.map((v) => v.toNumber()),
    aportesBloque2: fila.aportesBloque2.map((v) => v.toNumber()),
    refuerzo: numero(fila.refuerzo),
    notaProyecto: numero(fila.notaProyecto) ?? 0,
    notaExamen: numero(fila.notaExamen) ?? 0,
    notaFinal: numero(fila.notaFinal),
    cualitativo: fila.cualitativo,
    version: fila.version,
  };
}

const CAMPOS_EDITABLES = ['aportesBloque1', 'aportesBloque2', 'refuerzo', 'notaProyecto', 'notaExamen'] as const;

// El mismo 403 para una asignación ajena y una inexistente: no se puede averiguar cuáles existen
const accesoDenegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'Solo el docente de la materia puede calificar.');
const sinAccesoLectura = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para ver estas calificaciones.');

@Injectable()
export class ServicioCalificaciones {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra o actualiza la calificación trimestral y la recalcula en el servidor. */
  async guardar(solicitud: SolicitudCalificacion, usuario: UsuarioToken): Promise<Calificacion> {
    const asignacion = await this.prisma.asignacion.findUnique({
      where: { id: solicitud.asignacionId },
      include: { docente: { select: { usuarioId: true } }, curso: { select: { anioLectivoId: true } } },
    });
    // Solo el docente de ESTA materia en ESTE curso; la identidad sale únicamente del token
    if (!asignacion || asignacion.docente.usuarioId !== usuario.id) {
      throw accesoDenegado();
    }
    const matricula = await this.prisma.matricula.findUnique({ where: { id: solicitud.matriculaId } });
    if (!matricula || matricula.cursoId !== asignacion.cursoId || matricula.estado !== 'ACTIVA') {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El estudiante no tiene una matrícula activa en el curso de la asignación.');
    }
    const periodo = await this.prisma.periodo.findUnique({
      where: { anioLectivoId_numero: { anioLectivoId: asignacion.curso.anioLectivoId, numero: solicitud.trimestre } },
    });
    if (!periodo) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El trimestre no está configurado en el año lectivo.');
    }
    // Trimestre cerrado: las notas quedan bloqueadas (RN-18)
    if (periodo.cerrado) {
      throw new ExcepcionApi(409, 'TRIMESTRE_CERRADO', 'El trimestre está cerrado: sus notas ya no se pueden cambiar.');
    }

    const resultado = calcularCalificacionInmediata(solicitud);
    const datos = {
      aportesBloque1: solicitud.aportesBloque1,
      aportesBloque2: solicitud.aportesBloque2,
      refuerzo: solicitud.refuerzo ?? null,
      notaProyecto: solicitud.notaProyecto,
      notaExamen: solicitud.notaExamen,
      promedioAportes: resultado.promedioConRefuerzo === null ? null : truncarADosDecimales(resultado.promedioConRefuerzo),
      notaFinal: resultado.notaFinal,
      cualitativo: resultado.cualitativo,
      actualizadoPor: usuario.id,
    };

    const clave = { matriculaId: matricula.id, asignacionId: asignacion.id, periodoId: periodo.id };
    const actual = await this.prisma.calificacion.findUnique({ where: { matriculaId_asignacionId_periodoId: clave }, include: conPeriodo });

    if (!actual) {
      if (solicitud.version !== 0) {
        throw new ExcepcionApi(409, 'CONFLICTO', 'La calificación no existe: envía version 0 para crearla.');
      }
      const creada = await this.prisma.calificacion.create({ data: { id: solicitud.id ?? randomUUID(), ...clave, ...datos }, include: conPeriodo });
      return aRespuesta(creada);
    }
    if (solicitud.id && solicitud.id !== actual.id) {
      throw new ExcepcionApi(409, 'CONFLICTO', 'Ya existe otra calificación para ese estudiante, materia y trimestre.');
    }
    // Bloqueo optimista: solo se actualiza si nadie la cambió desde la versión que el docente vio
    const { count } = await this.prisma.calificacion.updateMany({
      where: { id: actual.id, version: solicitud.version },
      data: { ...datos, version: { increment: 1 } },
    });
    if (count === 0) {
      throw await this.conflicto(actual.id, solicitud);
    }
    return aRespuesta(await this.prisma.calificacion.findUniqueOrThrow({ where: { id: actual.id }, include: conPeriodo }));
  }

  private async conflicto(id: string, solicitud: SolicitudCalificacion): Promise<ExcepcionConflictoVersion> {
    const fila = await this.prisma.calificacion.findUniqueOrThrow({ where: { id }, include: conPeriodo });
    const servidor = aRespuesta(fila);
    const enviado: Record<(typeof CAMPOS_EDITABLES)[number], unknown> = {
      aportesBloque1: solicitud.aportesBloque1,
      aportesBloque2: solicitud.aportesBloque2,
      refuerzo: solicitud.refuerzo ?? null,
      notaProyecto: solicitud.notaProyecto,
      notaExamen: solicitud.notaExamen,
    };
    return new ExcepcionConflictoVersion({
      status: 'CONFLICT',
      entityId: id,
      baseVersion: solicitud.version,
      serverVersion: servidor.version,
      serverData: { ...servidor },
      serverUpdatedBy: fila.actualizadoPor,
      serverUpdatedAt: (fila.actualizadoEn ?? fila.creadoEn).toISOString(),
      conflictingFields: CAMPOS_EDITABLES.filter((campo) => JSON.stringify(servidor[campo]) !== JSON.stringify(enviado[campo])),
    });
  }

  /**
   * Libreta filtrada por rol: el docente ve solo sus materias, el estudiante solo lo suyo y el
   * administrador todo. Pedir una asignación o una matrícula ajena da 403 (T1118-A). El representante
   * verá a sus representados cuando exista la representación (T1111-M); mientras tanto, sin filtro
   * recibe una lista vacía y con filtro, 403: nunca datos ajenos.
   */
  async listar(filtro: FiltroCalificaciones, usuario: UsuarioToken): Promise<Calificacion[]> {
    const esAdmin = usuario.roles.includes('ADMIN');
    if (!esAdmin && filtro.asignacionId && !(await this.esDocenteDe(filtro.asignacionId, usuario))) {
      throw sinAccesoLectura();
    }
    if (!esAdmin && filtro.matriculaId && !(await this.puedeVerMatricula(filtro.matriculaId, usuario))) {
      throw sinAccesoLectura();
    }

    const condiciones: Prisma.CalificacionWhereInput[] = [];
    if (filtro.asignacionId) {
      condiciones.push({ asignacionId: filtro.asignacionId });
    }
    if (filtro.matriculaId) {
      condiciones.push({ matriculaId: filtro.matriculaId });
    }
    if (filtro.trimestre) {
      condiciones.push({ periodo: { numero: Number(filtro.trimestre) } });
    }

    if (!esAdmin) {
      const permitidas: Prisma.CalificacionWhereInput[] = [];
      if (usuario.roles.includes('DOCENTE')) {
        permitidas.push({ asignacion: { docente: { usuarioId: usuario.id } } });
      }
      if (usuario.roles.includes('ESTUDIANTE')) {
        permitidas.push({ matricula: { estudiante: { usuarioId: usuario.id } } });
      }
      if (permitidas.length === 0) {
        return [];
      }
      condiciones.push({ OR: permitidas });
    }

    const filas = await this.prisma.calificacion.findMany({
      where: { AND: condiciones },
      include: conPeriodo,
      orderBy: [{ asignacionId: 'asc' }, { periodo: { numero: 'asc' } }, { matriculaId: 'asc' }],
      take: 2000,
    });
    return filas.map(aRespuesta);
  }

  private async esDocenteDe(asignacionId: string, usuario: UsuarioToken): Promise<boolean> {
    if (!usuario.roles.includes('DOCENTE')) {
      return false;
    }
    const cantidad = await this.prisma.asignacion.count({ where: { id: asignacionId, docente: { usuarioId: usuario.id } } });
    return cantidad > 0;
  }

  /** El estudiante, su propia matrícula; el docente, las matrículas de un curso donde dicta clases. */
  private async puedeVerMatricula(matriculaId: string, usuario: UsuarioToken): Promise<boolean> {
    const matricula = await this.prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { cursoId: true, estudiante: { select: { usuarioId: true } } },
    });
    if (!matricula) {
      return false;
    }
    if (usuario.roles.includes('ESTUDIANTE') && matricula.estudiante.usuarioId === usuario.id) {
      return true;
    }
    if (usuario.roles.includes('DOCENTE')) {
      const cantidad = await this.prisma.asignacion.count({ where: { cursoId: matricula.cursoId, docente: { usuarioId: usuario.id } } });
      return cantidad > 0;
    }
    return false;
  }
}
