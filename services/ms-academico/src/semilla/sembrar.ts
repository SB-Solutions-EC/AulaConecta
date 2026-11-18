import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generado/prisma/client';

// Datos de prueba FICTICIOS de db_academico (T1116-M), leídos de infra/datos-prueba/datos.json.
// Los mismos UUID enlazan las cuentas de ms-identidad y los contactos de ms-notificaciones.
// Se puede ejecutar varias veces: cada registro se crea o se actualiza por su id (upsert).
// Uso: npm run build && npx prisma db seed   (con DATABASE_URL de la base de PRUEBAS)

interface PersonaDatos {
  id: string;
  usuarioId: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  sexo?: string;
  correo?: string;
  area?: string;
  fechaNacimiento?: string;
}

interface EstudianteDatos extends PersonaDatos {
  cursoId: string;
  matriculaId: string;
  codigoMatricula: string;
}

export interface DatosPrueba {
  anioLectivo: {
    id: string;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    activo: boolean;
    periodos: { id: string; numero: number; fechaInicio: string; fechaFin: string }[];
  };
  materias: { id: string; codigo: string; nombre: string; area: string }[];
  docentes: PersonaDatos[];
  cursos: { id: string; nivel: string; paralelo: string; tutorId: string }[];
  representantes: PersonaDatos[];
  estudiantes: EstudianteDatos[];
}

export interface ResumenSemilla {
  periodos: number;
  materias: number;
  personas: number;
  cursos: number;
  matriculas: number;
}

const fecha = (texto: string): Date => new Date(`${texto}T00:00:00Z`);

export function leerDatosPrueba(ruta = process.env.DATOS_PRUEBA_ARCHIVO ?? resolve(process.cwd(), '../../infra/datos-prueba/datos.json')): DatosPrueba {
  return JSON.parse(readFileSync(ruta, 'utf8')) as DatosPrueba;
}

function datosPersona(p: PersonaDatos, tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE') {
  return {
    usuarioId: p.usuarioId,
    tipo,
    cedula: p.cedula,
    nombres: p.nombres,
    apellidos: p.apellidos,
    sexo: p.sexo ?? null,
    correo: p.correo ?? null,
    area: p.area ?? null,
    fechaNacimiento: p.fechaNacimiento ? fecha(p.fechaNacimiento) : null,
  };
}

/** Carga los datos en una transacción: o queda todo, o nada. */
export async function sembrar(prisma: PrismaClient, datos: DatosPrueba): Promise<ResumenSemilla> {
  const { anioLectivo: anio } = datos;
  await prisma.$transaction(async (tx) => {
    const anioDatos = { nombre: anio.nombre, fechaInicio: fecha(anio.fechaInicio), fechaFin: fecha(anio.fechaFin), activo: anio.activo };
    await tx.anioLectivo.upsert({ where: { id: anio.id }, create: { id: anio.id, ...anioDatos }, update: anioDatos });

    for (const p of anio.periodos) {
      const periodo = { anioLectivoId: anio.id, numero: p.numero, fechaInicio: fecha(p.fechaInicio), fechaFin: fecha(p.fechaFin) };
      await tx.periodo.upsert({ where: { id: p.id }, create: { id: p.id, ...periodo }, update: periodo });
    }
    for (const m of datos.materias) {
      const materia = { codigo: m.codigo, nombre: m.nombre, area: m.area };
      await tx.materia.upsert({ where: { id: m.id }, create: { id: m.id, ...materia }, update: materia });
    }
    type Tipo = 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE';
    const personas: [PersonaDatos, Tipo][] = [
      ...datos.docentes.map((p): [PersonaDatos, Tipo] => [p, 'DOCENTE']),
      ...datos.representantes.map((p): [PersonaDatos, Tipo] => [p, 'REPRESENTANTE']),
      ...datos.estudiantes.map((p): [PersonaDatos, Tipo] => [p, 'ESTUDIANTE']),
    ];
    for (const [p, tipo] of personas) {
      const persona = datosPersona(p, tipo);
      await tx.persona.upsert({ where: { id: p.id }, create: { id: p.id, ...persona }, update: persona });
    }
    for (const c of datos.cursos) {
      const curso = { anioLectivoId: anio.id, nivel: c.nivel, paralelo: c.paralelo, tutorId: c.tutorId };
      await tx.curso.upsert({ where: { id: c.id }, create: { id: c.id, ...curso }, update: curso });
    }
    for (const e of datos.estudiantes) {
      const matricula = { estudianteId: e.id, cursoId: e.cursoId, codigoMatricula: e.codigoMatricula, fechaMatricula: fecha(anio.fechaInicio) };
      await tx.matricula.upsert({ where: { id: e.matriculaId }, create: { id: e.matriculaId, ...matricula }, update: matricula });
    }
  });
  return {
    periodos: anio.periodos.length,
    materias: datos.materias.length,
    personas: datos.docentes.length + datos.representantes.length + datos.estudiantes.length,
    cursos: datos.cursos.length,
    matriculas: datos.estudiantes.length,
  };
}

async function principal(): Promise<void> {
  // Nunca en producción: son datos inventados
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Los datos de prueba no se cargan con NODE_ENV=production');
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Falta DATABASE_URL de la base de pruebas');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const resumen = await sembrar(prisma, leerDatosPrueba());
    console.log('Datos de prueba cargados en db_academico:', resumen);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  principal().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
