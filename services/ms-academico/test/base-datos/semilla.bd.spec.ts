import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'node:path';
import { inject } from 'vitest';
import { PrismaClient } from '../../src/generado/prisma/client';
import { leerDatosPrueba, sembrar } from '../../src/semilla/sembrar';

// Datos de prueba ficticios (T1116-M) contra PostgreSQL real con las migraciones aplicadas.

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: inject('urlBaseDatos') }) });
const datos = leerDatosPrueba(resolve(__dirname, '../../../../infra/datos-prueba/datos.json'));

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Datos de prueba de db_academico', () => {
  it('carga año lectivo, trimestres, materias, personas, cursos y matrículas', async () => {
    const resumen = await sembrar(prisma, datos);

    expect(resumen).toEqual({ periodos: 3, materias: 7, personas: 22, cursos: 4, matriculas: 12 });
    expect(await prisma.periodo.count({ where: { anioLectivoId: datos.anioLectivo.id } })).toBe(3);
    expect(await prisma.matricula.count({ where: { curso: { anioLectivoId: datos.anioLectivo.id } } })).toBe(12);
  });

  it('se puede ejecutar otra vez sin duplicar nada', async () => {
    const antes = await prisma.persona.count();
    await sembrar(prisma, datos);

    expect(await prisma.persona.count()).toBe(antes);
    expect(await prisma.materia.count({ where: { codigo: 'MAT' } })).toBe(1);
  });

  it('solo usa cédulas imposibles (provincia 99) y correos del dominio reservado .test', () => {
    const personas = [...datos.docentes, ...datos.representantes, ...datos.estudiantes];

    expect(personas.every((p) => /^99\d{8}$/.test(p.cedula))).toBe(true);
    expect(personas.filter((p) => p.correo).every((p) => p.correo?.endsWith('@ejemplo.test'))).toBe(true);
  });

  it('enlaza cada persona con su cuenta de ms-identidad por usuario_id', async () => {
    const docente = datos.docentes[0];
    const persona = await prisma.persona.findUniqueOrThrow({ where: { id: docente.id } });

    expect(persona.usuarioId).toBe(docente.usuarioId);
  });
});
