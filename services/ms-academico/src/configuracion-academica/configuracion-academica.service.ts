import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../base-datos/prisma.service';
import { ExcepcionApi } from '../comun/excepcion-api';
import { SolicitudAnioLectivo, SolicitudCurso, SolicitudMateria, SolicitudPeriodo } from './solicitudes.dto';

// RF-06 y RF-07 sobre db_academico. Los duplicados que se escapen de las comprobaciones
// (dos altas a la vez) los frena la clave única de la base y el filtro de errores responde 409.

export interface AnioLectivo {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
  activo: boolean;
  version: number;
}

export interface Periodo {
  id: string;
  anioLectivoId: string;
  numero: number;
  inicio: string;
  fin: string;
  cerrado: boolean;
  version: number;
}

export interface Curso {
  id: string;
  anioLectivoId: string;
  nivel: string;
  paralelo: string;
  version: number;
}

export interface Materia {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
  version: number;
}

/** AAAA-MM-DD → fecha a medianoche UTC, que es como Prisma guarda una columna DATE. */
const aFecha = (texto: string): Date => new Date(`${texto}T00:00:00Z`);
const aTexto = (fecha: Date): string => fecha.toISOString().slice(0, 10);

const finAntesDelInicio = (): ExcepcionApi =>
  new ExcepcionApi(400, 'DATOS_INVALIDOS', 'La fecha de fin debe ser posterior al inicio.');
const anioInexistente = (): ExcepcionApi => new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El año lectivo no existe.');

function anioLectivo(fila: { id: string; nombre: string; fechaInicio: Date; fechaFin: Date; activo: boolean; version: number }): AnioLectivo {
  return { id: fila.id, nombre: fila.nombre, inicio: aTexto(fila.fechaInicio), fin: aTexto(fila.fechaFin), activo: fila.activo, version: fila.version };
}

function periodo(fila: {
  id: string;
  anioLectivoId: string;
  numero: number;
  fechaInicio: Date;
  fechaFin: Date;
  cerrado: boolean;
  version: number;
}): Periodo {
  return {
    id: fila.id,
    anioLectivoId: fila.anioLectivoId,
    numero: fila.numero,
    inicio: aTexto(fila.fechaInicio),
    fin: aTexto(fila.fechaFin),
    cerrado: fila.cerrado,
    version: fila.version,
  };
}

const curso = ({ id, anioLectivoId, nivel, paralelo, version }: Curso): Curso => ({ id, anioLectivoId, nivel, paralelo, version });
const materia = ({ id, codigo, nombre, area, version }: Materia): Materia => ({ id, codigo, nombre, area, version });

@Injectable()
export class ServicioConfiguracionAcademica {
  constructor(private readonly prisma: PrismaService) {}

  async listarAnios(): Promise<AnioLectivo[]> {
    const filas = await this.prisma.anioLectivo.findMany({ orderBy: { fechaInicio: 'desc' } });
    return filas.map(anioLectivo);
  }

  async crearAnio({ id, nombre, inicio, fin, activo }: SolicitudAnioLectivo): Promise<AnioLectivo> {
    if (fin <= inicio) {
      throw finAntesDelInicio();
    }
    const fila = await this.prisma.anioLectivo.create({
      data: { id: id ?? randomUUID(), nombre, fechaInicio: aFecha(inicio), fechaFin: aFecha(fin), activo: activo ?? true },
    });
    return anioLectivo(fila);
  }

  async listarPeriodos(anioLectivoId?: string): Promise<Periodo[]> {
    const filas = await this.prisma.periodo.findMany({
      where: anioLectivoId ? { anioLectivoId } : {},
      orderBy: [{ numero: 'asc' }, { fechaInicio: 'asc' }],
    });
    return filas.map(periodo);
  }

  /** RF-07 y RN-10: trimestre 1 a 3, dentro del año lectivo y sin superponerse con los demás. */
  async crearPeriodo({ id, anioLectivoId, numero, inicio, fin }: SolicitudPeriodo): Promise<Periodo> {
    return this.prisma.$transaction(async (tx) => {
      // Bloquea el año lectivo: dos trimestres creados a la vez no pueden superponerse
      const bloqueado = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM anio_lectivo WHERE id = ${anioLectivoId}::uuid FOR UPDATE`;
      const anio = bloqueado.length ? await tx.anioLectivo.findUnique({ where: { id: anioLectivoId } }) : null;
      if (!anio) {
        throw anioInexistente();
      }
      if (fin <= inicio) {
        throw finAntesDelInicio();
      }
      if (inicio < aTexto(anio.fechaInicio) || fin > aTexto(anio.fechaFin)) {
        throw new ExcepcionApi(400, 'FUERA_DEL_ANIO_LECTIVO', 'El trimestre debe quedar dentro del año lectivo.');
      }
      const delMismoAnio = (await tx.periodo.findMany({ where: { anioLectivoId } })).map(periodo);
      if (delMismoAnio.some((p) => p.numero === numero)) {
        throw new ExcepcionApi(409, 'CONFLICTO', 'Ese trimestre ya existe en el año lectivo.');
      }
      if (delMismoAnio.some((p) => inicio <= p.fin && fin >= p.inicio)) {
        throw new ExcepcionApi(400, 'TRIMESTRE_SUPERPUESTO', 'El trimestre se superpone con otro del mismo año.');
      }
      const fila = await tx.periodo.create({
        data: { id: id ?? randomUUID(), anioLectivoId, numero, fechaInicio: aFecha(inicio), fechaFin: aFecha(fin) },
      });
      return periodo(fila);
    });
  }

  async listarCursos(anioLectivoId?: string): Promise<Curso[]> {
    const filas = await this.prisma.curso.findMany({
      where: anioLectivoId ? { anioLectivoId } : {},
      orderBy: [{ nivel: 'asc' }, { paralelo: 'asc' }],
    });
    return filas.map(curso);
  }

  async crearCurso({ id, anioLectivoId, nivel, paralelo }: SolicitudCurso): Promise<Curso> {
    if (!(await this.prisma.anioLectivo.findUnique({ where: { id: anioLectivoId }, select: { id: true } }))) {
      throw anioInexistente();
    }
    return curso(await this.prisma.curso.create({ data: { id: id ?? randomUUID(), anioLectivoId, nivel, paralelo } }));
  }

  async listarMaterias(): Promise<Materia[]> {
    const filas = await this.prisma.materia.findMany({ orderBy: { nombre: 'asc' } });
    return filas.map(materia);
  }

  async crearMateria({ id, codigo, nombre, area }: SolicitudMateria): Promise<Materia> {
    // "Matemática" y "matemática" son la misma materia
    if (await this.prisma.materia.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } }, select: { id: true } })) {
      throw new ExcepcionApi(409, 'CONFLICTO', 'Ya existe una materia con ese nombre.');
    }
    return materia(await this.prisma.materia.create({ data: { id: id ?? randomUUID(), codigo, nombre, area: area ?? null } }));
  }
}
