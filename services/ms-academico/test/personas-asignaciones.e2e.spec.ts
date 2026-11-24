import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/base-datos/prisma.service';
import { AplicacionReal, crearAplicacionReal } from './seguridad/aplicacion-real';
import { cedulaFicticia, conVerificadorErroneo, palabraFicticia } from './seguridad/datos-ficticios';
import { tokenValido } from './seguridad/tokens';

// Personas y asignaciones (T1110-M) contra ms-academico real y PostgreSQL de Testcontainers.
// ms-identidad se reemplaza por IdentidadFalsa: se revisa qué le llega (nunca la cédula, CR-02).

// Años 9900 a 9997: no se cruzan con las demás pruebas que crean años lectivos en la misma base
const anio = 9900 + Math.floor(Math.random() * 98);
const fecha = (texto: string): Date => new Date(`${texto}T00:00:00Z`);
const sufijo = (): string => randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

let real: AplicacionReal;
let prisma: PrismaService;
const como = (roles: string[], sub?: string): string => `Bearer ${tokenValido(roles, sub ? { sub } : {})}`;
const ADMIN = como(['ADMIN']);
const SECRETARIA = como(['SECRETARIA']);

const post = (ruta: string, cuerpo: object, token = ADMIN): request.Test => request(real.servidor()).post(ruta).set('Authorization', token).send(cuerpo);
const get = (ruta: string, token = ADMIN): request.Test => request(real.servidor()).get(ruta).set('Authorization', token);
const persona = (tipo: string, cambios: object = {}): object => ({ tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia(), ...cambios });

const cursos = { a: randomUUID(), b: randomUUID() };
const materias = { m1: randomUUID(), m2: randomUUID(), m3: randomUUID() };

beforeAll(async () => {
  real = await crearAplicacionReal();
  prisma = real.app.get(PrismaService);
  const anioLectivoId = randomUUID();
  await prisma.anioLectivo.create({ data: { id: anioLectivoId, nombre: `${anio}-${anio + 1}`, fechaInicio: fecha(`${anio}-09-01`), fechaFin: fecha(`${anio + 1}-07-01`) } });
  await prisma.curso.createMany({
    data: [
      { id: cursos.a, anioLectivoId, nivel: '8vo EGB', paralelo: 'A' },
      { id: cursos.b, anioLectivoId, nivel: '8vo EGB', paralelo: 'B' },
    ],
  });
  await prisma.materia.createMany({
    data: Object.values(materias).map((id) => ({ id, codigo: `M${sufijo()}`, nombre: palabraFicticia() })),
  });
});

afterAll(async () => {
  await real?.cerrar();
});

describe('POST /personas', () => {
  it('la secretaría registra un estudiante: crea la cuenta sin enviar la cédula y entrega la clave temporal una sola vez', async () => {
    const datos = persona('ESTUDIANTE');
    const respuesta = await post('/personas', datos, SECRETARIA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ tipo: 'ESTUDIANTE', area: null, usuarioId: respuesta.body.id });
    expect(respuesta.body.credenciales).toMatchObject({ nombreUsuario: expect.any(String), claveTemporal: expect.any(String) });
    expect(respuesta.text).not.toContain((datos as { cedula: string }).cedula);
    const recibida = real.identidad.recibidas.at(-1);
    expect(recibida).toMatchObject({ id: respuesta.body.id, roles: ['ESTUDIANTE'] });
    expect(JSON.stringify(recibida)).not.toContain((datos as { cedula: string }).cedula);
  });

  it('guarda el área solo para docentes', async () => {
    const docente = await post('/personas', persona('DOCENTE', { area: 'Ciencias Naturales' }));
    const estudiante = await post('/personas', persona('ESTUDIANTE', { area: 'Ciencias Naturales' }));

    expect([docente.status, estudiante.status]).toEqual([201, 201]);
    expect([docente.body.area, estudiante.body.area]).toEqual(['Ciencias Naturales', null]);
  });

  it('una cédula repetida da 409 y no crea otra cuenta en ms-identidad', async () => {
    const datos = persona('REPRESENTANTE');
    expect((await post('/personas', datos)).status).toBe(201);
    const cuentas = real.identidad.recibidas.length;

    const repetida = await post('/personas', { ...datos, nombres: palabraFicticia() });

    expect(repetida.status).toBe(409);
    expect(real.identidad.recibidas.length).toBe(cuentas);
  });

  it.each([
    ['una cédula con verificador erróneo', { cedula: conVerificadorErroneo(cedulaFicticia()) }],
    ['un tipo que no existe', { tipo: 'ADMIN' }],
    ['nombres con código', { nombres: '<script>alert(1)</script>' }],
    ['un campo que el contrato no define', { usuarioId: randomUUID() }],
  ])('400 con %s', async (_caso, cambios) => {
    const respuesta = await post('/personas', persona('ESTUDIANTE', cambios));

    expect(respuesta.status).toBe(400);
  });

  it.each([['DOCENTE'], ['ESTUDIANTE'], ['REPRESENTANTE']])('el rol %s no registra personas', async (rol) => {
    const respuesta = await post('/personas', persona('ESTUDIANTE'), como([rol]));

    expect(respuesta.status).toBe(403);
  });
});

describe('GET /personas', () => {
  it('el personal busca por tipo y nombre, sin cédula ni clave temporal en la respuesta', async () => {
    const datos = persona('DOCENTE');
    await post('/personas', datos);
    const nombre = (datos as { nombres: string }).nombres;

    const respuesta = await get(`/personas?tipo=DOCENTE&q=${nombre.toLowerCase()}`, SECRETARIA);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0]).toMatchObject({ tipo: 'DOCENTE', nombres: nombre });
    expect(respuesta.text).not.toContain((datos as { cedula: string }).cedula);
    expect(respuesta.text).not.toMatch(/claveTemporal|cedula/i);
  });

  it('el estudiante solo se ve a sí mismo', async () => {
    const creado = await post('/personas', persona('ESTUDIANTE'));
    await post('/personas', persona('ESTUDIANTE'));

    const respuesta = await get('/personas', como(['ESTUDIANTE'], creado.body.usuarioId));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((p: { id: string }) => p.id)).toEqual([creado.body.id]);
  });

  it('el docente no lista personas', async () => {
    expect((await get('/personas', como(['DOCENTE']))).status).toBe(403);
  });
});

describe('Asignaciones', () => {
  let docente: { id: string; usuarioId: string };
  let otroDocente: { id: string; usuarioId: string };

  beforeAll(async () => {
    docente = (await post('/personas', persona('DOCENTE'))).body;
    otroDocente = (await post('/personas', persona('DOCENTE'))).body;
  });

  it('el administrador asigna docente, materia y curso con bloques horarios ordenados y con id', async () => {
    const respuesta = await post('/asignaciones', {
      docenteId: docente.id,
      materiaId: materias.m1,
      cursoId: cursos.a,
      horarios: [{ dia: 3, hora: 'h2' }, { dia: 1, hora: 'h1' }],
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ docenteId: docente.id, materiaId: materias.m1, cursoId: cursos.a });
    expect(respuesta.body.horarios.map((b: { dia: number; hora: string }) => `${b.dia}${b.hora}`)).toEqual(['1h1', '3h2']);
    expect(respuesta.body.horarios.every((b: { id: string }) => typeof b.id === 'string')).toBe(true);
  });

  it('409 si la materia ya tiene docente en ese curso', async () => {
    const respuesta = await post('/asignaciones', { docenteId: otroDocente.id, materiaId: materias.m1, cursoId: cursos.a });

    expect(respuesta.status).toBe(409);
  });

  it('409 HORARIO_OCUPADO si el curso ya tiene otra materia en ese bloque', async () => {
    const respuesta = await post('/asignaciones', { docenteId: otroDocente.id, materiaId: materias.m2, cursoId: cursos.a, horarios: [{ dia: 1, hora: 'h1' }] });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('HORARIO_OCUPADO');
  });

  it('409 HORARIO_OCUPADO si el docente ya tiene clase en otro curso a esa hora', async () => {
    const respuesta = await post('/asignaciones', { docenteId: docente.id, materiaId: materias.m1, cursoId: cursos.b, horarios: [{ dia: 3, hora: 'h2' }] });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('HORARIO_OCUPADO');
  });

  it.each([
    ['bloques repetidos', { horarios: [{ dia: 2, hora: 'h1' }, { dia: 2, hora: 'h1' }] }],
    ['día 6', { horarios: [{ dia: 6, hora: 'h1' }] }],
    ['hora h6', { horarios: [{ dia: 2, hora: 'h6' }] }],
    ['horarios que no son lista', { horarios: { $ne: null } }],
  ])('400 con %s', async (_caso, cambios) => {
    const respuesta = await post('/asignaciones', { docenteId: otroDocente.id, materiaId: materias.m3, cursoId: cursos.b, ...cambios });

    expect(respuesta.status).toBe(400);
  });

  it('400 si el docente no es una persona de tipo DOCENTE', async () => {
    const estudiante = (await post('/personas', persona('ESTUDIANTE'))).body;
    const respuesta = await post('/asignaciones', { docenteId: estudiante.id, materiaId: materias.m3, cursoId: cursos.b });

    expect(respuesta.status).toBe(400);
  });

  it('solo el administrador asigna', async () => {
    const respuesta = await post('/asignaciones', { docenteId: otroDocente.id, materiaId: materias.m3, cursoId: cursos.b }, SECRETARIA);

    expect(respuesta.status).toBe(403);
  });

  it('el docente ve solo sus asignaciones y no puede pedir las de otro', async () => {
    const propias = await get('/asignaciones', como(['DOCENTE'], docente.usuarioId));
    const ajenas = await get(`/asignaciones?docenteId=${otroDocente.id}`, como(['DOCENTE'], docente.usuarioId));

    expect(propias.status).toBe(200);
    expect(propias.body.map((a: { docenteId: string }) => a.docenteId)).toEqual([docente.id]);
    expect(ajenas.status).toBe(403);
  });

  it('el administrador filtra por curso', async () => {
    const respuesta = await get(`/asignaciones?cursoId=${cursos.a}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.every((a: { cursoId: string }) => a.cursoId === cursos.a)).toBe(true);
    expect(respuesta.body.length).toBeGreaterThan(0);
  });
});
