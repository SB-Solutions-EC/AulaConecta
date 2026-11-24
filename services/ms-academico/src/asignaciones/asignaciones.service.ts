import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { PrismaService } from '../base-datos/prisma.service';
import { ExcepcionApi } from '../comun/excepcion-api';
import { Prisma } from '../generado/prisma/client';
import { FiltroAsignaciones, Hora, SolicitudAsignacion } from './solicitudes.dto';

// Asignación docente–materia–curso con sus bloques horarios (RF-05, RF-37, T1110-M).

export interface Bloque {
  id: string;
  dia: number;
  hora: Hora;
}

export interface Asignacion {
  id: string;
  docenteId: string;
  materiaId: string;
  cursoId: string;
  horarios: Bloque[];
  version: number;
}

const PERSONAL = ['ADMIN', 'SECRETARIA'];
const clave = (b: { dia: number; hora: string }): string => `${b.dia}-${b.hora}`;
const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const describir = (b: { dia: number; hora: string }): string => `${DIAS[b.dia]} ${b.hora}`;

function aRespuesta(fila: { id: string; docenteId: string; materiaId: string; cursoId: string; horarios: Prisma.JsonValue; version: number }): Asignacion {
  return {
    id: fila.id,
    docenteId: fila.docenteId,
    materiaId: fila.materiaId,
    cursoId: fila.cursoId,
    horarios: (Array.isArray(fila.horarios) ? fila.horarios : []) as unknown as Bloque[],
    version: fila.version,
  };
}

const sinAcceso = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para ver estas asignaciones.');

@Injectable()
export class ServicioAsignaciones {
  constructor(private readonly prisma: PrismaService) {}

  async crear(solicitud: SolicitudAsignacion): Promise<Asignacion> {
    const bloques: Bloque[] = (solicitud.horarios ?? [])
      .map((b) => ({ id: b.id ?? randomUUID(), dia: b.dia, hora: b.hora }))
      .sort((a, b) => clave(a).localeCompare(clave(b)));
    if (new Set(bloques.map(clave)).size !== bloques.length) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'Hay bloques horarios repetidos.');
    }

    const docente = await this.prisma.persona.findUnique({ where: { id: solicitud.docenteId }, select: { tipo: true, activo: true } });
    if (docente?.tipo !== 'DOCENTE' || !docente.activo) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El docente no existe.');
    }
    const [materia, curso] = await Promise.all([
      this.prisma.materia.findUnique({ where: { id: solicitud.materiaId }, select: { id: true } }),
      this.prisma.curso.findUnique({ where: { id: solicitud.cursoId }, select: { anioLectivoId: true } }),
    ]);
    if (!materia || !curso) {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'La materia o el curso no existen.');
    }
    if (await this.prisma.asignacion.count({ where: { materiaId: solicitud.materiaId, cursoId: solicitud.cursoId } })) {
      throw new ExcepcionApi(409, 'CONFLICTO', 'La materia ya tiene docente en ese curso.');
    }

    // Choques de horario: el docente no puede estar en dos cursos a la vez, ni el curso tener dos materias a la vez
    if (bloques.length > 0) {
      const otras = await this.prisma.asignacion.findMany({
        where: { OR: [{ docenteId: solicitud.docenteId, curso: { anioLectivoId: curso.anioLectivoId } }, { cursoId: solicitud.cursoId }] },
        select: { docenteId: true, cursoId: true, horarios: true },
      });
      const pedidos = new Set(bloques.map(clave));
      for (const otra of otras) {
        const choque = aRespuesta({ ...otra, id: '', materiaId: '', version: 0 }).horarios.find((b) => pedidos.has(clave(b)));
        if (choque) {
          const quien = otra.docenteId === solicitud.docenteId ? 'El docente ya tiene clase' : 'El curso ya tiene otra materia';
          throw new ExcepcionApi(409, 'HORARIO_OCUPADO', `${quien} el ${describir(choque)}.`);
        }
      }
    }

    const creada = await this.prisma.asignacion.create({
      data: {
        id: solicitud.id ?? randomUUID(),
        docenteId: solicitud.docenteId,
        materiaId: solicitud.materiaId,
        cursoId: solicitud.cursoId,
        horarios: bloques as unknown as Prisma.InputJsonValue,
      },
    });
    return aRespuesta(creada);
  }

  /** El personal ve todas; el docente, solo las suyas (pedir las de otro docente da 403). */
  async listar(filtro: FiltroAsignaciones, usuario: UsuarioToken): Promise<Asignacion[]> {
    const condiciones: Prisma.AsignacionWhereInput[] = [];
    if (!usuario.roles.some((rol) => PERSONAL.includes(rol))) {
      if (filtro.docenteId) {
        const propio = await this.prisma.persona.count({ where: { id: filtro.docenteId, usuarioId: usuario.id } });
        if (!propio) {
          throw sinAcceso();
        }
      }
      condiciones.push({ docente: { usuarioId: usuario.id } });
    }
    if (filtro.docenteId) {
      condiciones.push({ docenteId: filtro.docenteId });
    }
    if (filtro.cursoId) {
      condiciones.push({ cursoId: filtro.cursoId });
    }
    const filas = await this.prisma.asignacion.findMany({ where: { AND: condiciones }, orderBy: [{ cursoId: 'asc' }, { materiaId: 'asc' }], take: 500 });
    return filas.map(aRespuesta);
  }
}
