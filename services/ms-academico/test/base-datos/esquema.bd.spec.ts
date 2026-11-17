import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { PrismaService } from '../../src/base-datos/prisma.service';

// Pruebas de integración de db_academico contra PostgreSQL real (Testcontainers, T1104-M).
// Comprueban que las restricciones del modelo (docs/modelos/bd) existen en la base y no
// solo en el código: unicidad, llaves foráneas, borrado restringido y valores por defecto.

const prisma = new PrismaService(new ConfigService({ baseDatosUrl: inject('urlBaseDatos') }));
const fecha = (texto: string): Date => new Date(`${texto}T00:00:00Z`);
let secuencia = 0;
const base = 2100 + Math.floor(Math.random() * 6000); // años de 4 dígitos, distintos en cada ejecución
const unico = (): number => base + ++secuencia;

async function crearAnio(): Promise<string> {
  const anio = unico();
  const { id } = await prisma.anioLectivo.create({
    data: { id: randomUUID(), nombre: `${anio}-${anio + 1}`, fechaInicio: fecha(`${anio}-09-01`), fechaFin: fecha(`${anio + 1}-07-15`) },
  });
  return id;
}

async function crearPersona(tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<string> {
  const { id } = await prisma.persona.create({
    data: { id: randomUUID(), tipo, cedula: `99${String(unico()).padStart(8, '0')}` /* provincia 99: no existe, nunca es real */, nombres: 'Ana', apellidos: 'Pérez' },
  });
  return id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('db_academico en PostgreSQL real', () => {
  it('aplica las migraciones: existen las tablas del modelo', async () => {
    const tablas = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;

    expect(tablas.map((t) => t.tablename)).toEqual(
      expect.arrayContaining(['anio_lectivo', 'periodo', 'curso', 'materia', 'persona', 'matricula']),
    );
  });

  it('guarda el UUID generado por la aplicación y pone version = 1', async () => {
    const id = randomUUID();
    const materia = await prisma.materia.create({ data: { id, codigo: `F${unico()}`, nombre: `Física ${unico()}`, area: 'Ciencias Naturales' } });

    expect(materia).toMatchObject({ id, version: 1 });
  });

  it('rechaza dos años lectivos con el mismo nombre (clave única)', async () => {
    const anio = await prisma.anioLectivo.findUniqueOrThrow({ where: { id: await crearAnio() } });

    await expect(
      prisma.anioLectivo.create({ data: { id: randomUUID(), nombre: anio.nombre, fechaInicio: anio.fechaInicio, fechaFin: anio.fechaFin } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rechaza el mismo nivel y paralelo dos veces en un año lectivo', async () => {
    const anioLectivoId = await crearAnio();
    await prisma.curso.create({ data: { id: randomUUID(), anioLectivoId, nivel: '8vo EGB', paralelo: 'A' } });

    await expect(prisma.curso.create({ data: { id: randomUUID(), anioLectivoId, nivel: '8vo EGB', paralelo: 'A' } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rechaza un curso de un año lectivo que no existe (llave foránea)', async () => {
    await expect(
      prisma.curso.create({ data: { id: randomUUID(), anioLectivoId: randomUUID(), nivel: '9no EGB', paralelo: 'B' } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('no deja matricular dos veces al mismo estudiante en el mismo curso', async () => {
    const cursoId = (await prisma.curso.create({ data: { id: randomUUID(), anioLectivoId: await crearAnio(), nivel: '7mo EGB', paralelo: 'A' } })).id;
    const estudianteId = await crearPersona('ESTUDIANTE');
    const matricula = await prisma.matricula.create({ data: { id: randomUUID(), codigoMatricula: `AND-${unico()}`, estudianteId, cursoId } });

    expect(matricula.estado).toBe('ACTIVA');
    await expect(prisma.matricula.create({ data: { id: randomUUID(), codigoMatricula: `AND-${unico()}`, estudianteId, cursoId } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('no borra un año lectivo que tiene cursos (borrado restringido: se conserva el historial)', async () => {
    const anioLectivoId = await crearAnio();
    await prisma.curso.create({ data: { id: randomUUID(), anioLectivoId, nivel: '10mo EGB', paralelo: 'A' } });

    await expect(prisma.anioLectivo.delete({ where: { id: anioLectivoId } })).rejects.toBeDefined();
    expect(await prisma.anioLectivo.findUnique({ where: { id: anioLectivoId } })).not.toBeNull();
  });

  it('enlaza cada persona con una sola cuenta de ms-identidad (usuario_id único, relación 1 a 1)', async () => {
    const usuarioId = randomUUID();
    await prisma.persona.update({ where: { id: await crearPersona('DOCENTE') }, data: { usuarioId } });

    await expect(prisma.persona.update({ where: { id: await crearPersona('DOCENTE') }, data: { usuarioId } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('guarda las fechas como DATE, sin hora ni zona horaria', async () => {
    const anio = await prisma.anioLectivo.findUniqueOrThrow({ where: { id: await crearAnio() } });

    expect(anio.fechaInicio.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });
  // Alineación con el diccionario de datos del Taller 2 (migración 20261116000000_alineacion_taller2)
  it('el código de materia es obligatorio y único; el área es opcional', async () => {
    const codigo = `Q${unico()}`;
    await prisma.materia.create({ data: { id: randomUUID(), codigo, nombre: 'Química' } });

    await expect(prisma.materia.create({ data: { id: randomUUID(), codigo, nombre: 'Química II' } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('el código visible de la matrícula es único', async () => {
    const anioLectivoId = await crearAnio();
    const { id: cursoId } = await prisma.curso.create({ data: { id: randomUUID(), anioLectivoId, nivel: '9no EGB', paralelo: 'B' } });
    const codigoMatricula = `AND-${unico()}`;
    await prisma.matricula.create({ data: { id: randomUUID(), codigoMatricula, estudianteId: await crearPersona('ESTUDIANTE'), cursoId } });

    await expect(
      prisma.matricula.create({ data: { id: randomUUID(), codigoMatricula, estudianteId: await crearPersona('ESTUDIANTE'), cursoId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('los datos opcionales de la persona respetan el diccionario: correo único y sexo M o F', async () => {
    const correo = `persona${unico()}@ejemplo.ec`;
    await prisma.persona.update({ where: { id: await crearPersona('DOCENTE') }, data: { correo, sexo: 'F', fechaNacimiento: fecha('1990-05-20') } });

    await expect(prisma.persona.update({ where: { id: await crearPersona('DOCENTE') }, data: { correo } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.persona.update({ where: { id: await crearPersona('DOCENTE') }, data: { sexo: 'X' } })).rejects.toBeDefined();
  });
});
