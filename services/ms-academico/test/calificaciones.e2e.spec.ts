import { calcularCalificacionInmediata } from '../src/generado/calculo-notas';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/base-datos/prisma.service';
import { AplicacionReal, crearAplicacionReal } from './seguridad/aplicacion-real';
import { tokenValido } from './seguridad/tokens';

// Calificaciones (T1118-M) contra ms-academico real y PostgreSQL de Testcontainers:
// el servidor recalcula con packages/calculo-notas y solo el docente de la materia califica.

// Años 9600 a 9899: no se cruzan con test/seguridad (2100–7100), esquema.bd (7500–9500) ni los datos de prueba
const anio = 9600 + Math.floor(Math.random() * 300);
const sufijo = (): string => randomUUID().replace(/-/g, '').slice(0, 8);
const fecha = (texto: string): Date => new Date(`${texto}T00:00:00Z`);

let real: AplicacionReal;
let prisma: PrismaService;
const ids = {
  docente: randomUUID(),
  otroDocente: randomUUID(),
  estudiante: randomUUID(),
  otroEstudiante: randomUUID(),
  asignacion: randomUUID(),
  matricula: randomUUID(),
  matriculaOtroCurso: randomUUID(),
};
const cuentas = { docente: randomUUID(), otroDocente: randomUUID(), estudiante: randomUUID(), otroEstudiante: randomUUID() };

const como = (roles: string[], sub?: string): string => `Bearer ${tokenValido(roles, sub ? { sub } : {})}`;
const docente = (): string => como(['DOCENTE'], cuentas.docente);

const cuerpo = (cambios: Record<string, unknown> = {}): Record<string, unknown> => ({
  asignacionId: ids.asignacion,
  matriculaId: ids.matricula,
  trimestre: 1,
  aportesBloque1: [8, 9, 8.5, 8.5, 9],
  aportesBloque2: [8, 8, 9, 8, 9],
  refuerzo: null,
  notaProyecto: 9,
  notaExamen: 8.5,
  version: 0,
  ...cambios,
});

const guardar = (datos: Record<string, unknown>, token = docente()): request.Test =>
  request(real.servidor()).put('/calificaciones').set('Authorization', token).send(datos);
const listar = (token: string, consulta = ''): request.Test =>
  request(real.servidor()).get(`/calificaciones${consulta}`).set('Authorization', token);

async function persona(id: string, usuarioId: string, tipo: 'DOCENTE' | 'ESTUDIANTE'): Promise<void> {
  await prisma.persona.create({ data: { id, usuarioId, tipo, cedula: `99${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, nombres: 'Prueba', apellidos: 'Ficticia' } });
}

beforeAll(async () => {
  real = await crearAplicacionReal();
  prisma = real.app.get(PrismaService);

  const anioLectivoId = randomUUID();
  await prisma.anioLectivo.create({ data: { id: anioLectivoId, nombre: `${anio}-${anio + 1}`, fechaInicio: fecha(`${anio}-09-01`), fechaFin: fecha(`${anio + 1}-07-01`) } });
  for (const [numero, cerrado] of [[1, false], [2, false], [3, true]] as const) {
    await prisma.periodo.create({
      data: { id: randomUUID(), anioLectivoId, numero, cerrado, fechaInicio: fecha(`${anio + (numero > 1 ? 1 : 0)}-0${numero}-01`), fechaFin: fecha(`${anio + (numero > 1 ? 1 : 0)}-0${numero}-28`) },
    });
  }
  const curso = randomUUID();
  const otroCurso = randomUUID();
  await prisma.curso.createMany({ data: [{ id: curso, anioLectivoId, nivel: '9no EGB', paralelo: 'A' }, { id: otroCurso, anioLectivoId, nivel: '9no EGB', paralelo: 'B' }] });
  const materia = randomUUID();
  await prisma.materia.create({ data: { id: materia, codigo: `M${sufijo()}`.toUpperCase(), nombre: 'Matemática' } });

  await persona(ids.docente, cuentas.docente, 'DOCENTE');
  await persona(ids.otroDocente, cuentas.otroDocente, 'DOCENTE');
  await persona(ids.estudiante, cuentas.estudiante, 'ESTUDIANTE');
  await persona(ids.otroEstudiante, cuentas.otroEstudiante, 'ESTUDIANTE');
  await prisma.asignacion.create({ data: { id: ids.asignacion, docenteId: ids.docente, materiaId: materia, cursoId: curso } });
  await prisma.matricula.create({ data: { id: ids.matricula, estudianteId: ids.estudiante, cursoId: curso, codigoMatricula: `C-${sufijo()}` } });
  await prisma.matricula.create({ data: { id: ids.matriculaOtroCurso, estudianteId: ids.otroEstudiante, cursoId: otroCurso, codigoMatricula: `C-${sufijo()}` } });
});

afterAll(async () => {
  await real?.cerrar();
});

describe('PUT /calificaciones', () => {
  it('el docente de la materia la crea y el servidor calcula nota final y cualitativo con packages/calculo-notas', async () => {
    const respuesta = await guardar(cuerpo()).expect(200);
    const esperado = calcularCalificacionInmediata(cuerpo() as never);

    expect(respuesta.body).toMatchObject({ asignacionId: ids.asignacion, matriculaId: ids.matricula, trimestre: 1, notaFinal: 8.57, cualitativo: 'B+', version: 1 });
    expect(respuesta.body.notaFinal).toBe(esperado.notaFinal);
    expect(respuesta.body.aportesBloque1).toEqual([8, 9, 8.5, 8.5, 9]);
  });

  it('al actualizar con la versión vigente recalcula y sube la versión', async () => {
    const respuesta = await guardar(cuerpo({ aportesBloque1: [6, 6], aportesBloque2: [6, 6], refuerzo: 8, notaProyecto: 7, notaExamen: 7, version: 1 })).expect(200);

    expect(respuesta.body).toMatchObject({ notaFinal: 7, cualitativo: 'B-', refuerzo: 8, version: 2 });
  });

  it('con una versión vieja responde 409 con los datos del servidor y los campos en conflicto', async () => {
    const respuesta = await guardar(cuerpo({ notaExamen: 10, version: 1 })).expect(409);

    expect(respuesta.body).toMatchObject({ status: 'CONFLICT', baseVersion: 1, serverVersion: 2, serverUpdatedBy: cuentas.docente });
    expect(respuesta.body.serverData).toMatchObject({ notaFinal: 7, version: 2 });
    expect(respuesta.body.conflictingFields).toEqual(expect.arrayContaining(['aportesBloque1', 'refuerzo', 'notaExamen']));
  });

  it('no acepta la nota final ni el cualitativo del cliente', async () => {
    const respuesta = await guardar(cuerpo({ trimestre: 2, notaFinal: 10, cualitativo: 'A+' })).expect(400);

    expect(respuesta.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('otro docente recibe 403 aunque tenga el rol DOCENTE', async () => {
    const respuesta = await guardar(cuerpo({ trimestre: 2 }), como(['DOCENTE'], cuentas.otroDocente)).expect(403);

    expect(respuesta.body.codigo).toBe('ACCESO_DENEGADO');
  });

  it.each([
    ['SECRETARIA'],
    ['ADMIN'],
    ['ESTUDIANTE'],
    ['REPRESENTANTE'],
  ])('el rol %s no puede calificar', async (rol) => {
    const respuesta = await guardar(cuerpo({ trimestre: 2 }), como([rol], cuentas.docente));

    expect(respuesta.status).toBe(403);
  });

  it.each([
    ['una nota mayor a 10', { notaExamen: 10.5 }],
    ['una nota negativa', { aportesBloque1: [8, -1] }],
    ['más de 2 decimales', { notaProyecto: 8.555 }],
    ['un aporte que no es número', { aportesBloque2: ['9'] }],
    ['trimestre 4', { trimestre: 4 }],
    ['más de 5 aportes en un bloque (libro oficial)', { aportesBloque1: [8, 8, 8, 8, 8, 8] }],
    ['version negativa', { version: -1 }],
  ])('responde 400 con %s', async (_caso, cambios) => {
    const respuesta = await guardar(cuerpo({ trimestre: 2, ...cambios })).expect(400);

    expect(respuesta.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('no deja cambiar notas de un trimestre cerrado (RN-18)', async () => {
    const respuesta = await guardar(cuerpo({ trimestre: 3 })).expect(409);

    expect(respuesta.body.codigo).toBe('TRIMESTRE_CERRADO');
  });

  it('rechaza una matrícula de otro curso', async () => {
    const respuesta = await guardar(cuerpo({ trimestre: 2, matriculaId: ids.matriculaOtroCurso }));

    expect(respuesta.status).toBe(400);
  });

  it('una asignación inexistente da el mismo 403 que una ajena', async () => {
    const inventada = await guardar(cuerpo({ trimestre: 2, asignacionId: randomUUID() })).expect(403);
    const ajena = await guardar(cuerpo({ trimestre: 2 }), como(['DOCENTE'], cuentas.otroDocente)).expect(403);

    expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
  });

  it('una calificación nueva necesita version 0', async () => {
    const respuesta = await guardar(cuerpo({ trimestre: 2, version: 3 }));

    expect(respuesta.status).toBe(409);
  });
});

describe('GET /calificaciones', () => {
  it('el docente ve las calificaciones de su materia', async () => {
    const respuesta = await listar(docente(), `?asignacionId=${ids.asignacion}`).expect(200);

    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0]).toMatchObject({ matriculaId: ids.matricula, notaFinal: 7 });
  });

  it('el estudiante ve solo lo suyo sin filtro; otro estudiante sin filtro no ve nada', async () => {
    const propio = await listar(como(['ESTUDIANTE'], cuentas.estudiante)).expect(200);
    const otro = await listar(como(['ESTUDIANTE'], cuentas.otroEstudiante)).expect(200);

    expect(propio.body.map((c: { matriculaId: string }) => c.matriculaId)).toEqual([ids.matricula]);
    expect(otro.body).toEqual([]);
  });

  it('403 si un estudiante pide la matrícula de un compañero', async () => {
    const respuesta = await listar(como(['ESTUDIANTE'], cuentas.otroEstudiante), `?matriculaId=${ids.matricula}`);

    expect(respuesta.status).toBe(403);
  });

  it('403 si otro docente pide la libreta de una materia ajena o inventada', async () => {
    const ajena = await listar(como(['DOCENTE'], cuentas.otroDocente), `?asignacionId=${ids.asignacion}`);
    const inventada = await listar(docente(), `?asignacionId=${randomUUID()}`);

    expect([ajena.status, inventada.status]).toEqual([403, 403]);
  });

  it('el representante: sin filtro, lista vacía; con la matrícula de alguien, 403 (hasta T1111-M)', async () => {
    const sinFiltro = await listar(como(['REPRESENTANTE'])).expect(200);

    expect(sinFiltro.body).toEqual([]);
    expect((await listar(como(['REPRESENTANTE']), `?matriculaId=${ids.matricula}`)).status).toBe(403);
  });

  it('la secretaría recibe 403', async () => {
    const respuesta = await listar(como(['SECRETARIA']));

    expect(respuesta.status).toBe(403);
  });

  it('el administrador ve la libreta y filtra por trimestre', async () => {
    const primero = await listar(como(['ADMIN']), `?asignacionId=${ids.asignacion}&trimestre=1`).expect(200);
    const segundo = await listar(como(['ADMIN']), `?asignacionId=${ids.asignacion}&trimestre=2`).expect(200);

    expect(primero.body).toHaveLength(1);
    expect(segundo.body).toEqual([]);
  });

  it('rechaza filtros inválidos', async () => {
    const trimestre = await listar(docente(), '?trimestre=5');
    const inyeccion = await listar(docente(), "?asignacionId=' OR 1=1 --");

    expect([trimestre.status, inyeccion.status]).toEqual([400, 400]);
  });

  it('sin token responde 401', async () => {
    const respuesta = await request(real.servidor()).get('/calificaciones');

    expect(respuesta.status).toBe(401);
  });
});
