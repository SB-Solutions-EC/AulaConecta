import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';
import { ANIOS_LECTIVOS, Cuerpo, MATERIAS } from './endpoints-academicos';
import { tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Acceso a notas (RF-20, RF-18, RNF-04, T1120-A): un estudiante solo ve SUS notas; un representante,
// solo las de sus representados. Matriz de quién pide qué en todo lo que expone notas:
//   GET /calificaciones (sin filtro, por matrícula, por asignación) y GET /tareas/{id}/entregas.
//
// Escenario armado por la API:
//   curso A (asignaciones A1 de D1 y A2 de D2): estudiantes E1 y E2
//   curso B (asignación B1 de D3): estudiante F
//   representantes: R1 (de E1), R2 (de E2), R12 (de E1 y E2), RF (de F)
//   notas: calificación del trimestre 1 de E1 y E2 en A1 y de F en B1; tarea T1 (A1) calificada a E1 y E2,
//   tarea TB (B1) calificada a F; cada retroalimentación tiene un texto único para detectar fugas.
// Se aplica igual a la implementación de referencia y a los endpoints reales.

export interface ActorNotas {
  personaId: string;
  usuarioId: string;
  token: string;
}

export interface MundoNotas {
  asignacionA1: string;
  e1: ActorNotas;
  e2: ActorNotas;
  f: ActorNotas;
  r1: ActorNotas;
  r2: ActorNotas;
  r12: ActorNotas;
  rf: ActorNotas;
  d1: ActorNotas;
  d2: ActorNotas;
  d3: ActorNotas;
  /** Matrícula de cada estudiante. */
  matricula: { e1: string; e2: string; f: string };
  tareaA: string;
  tareaB: string;
  /** Texto único de la retroalimentación de cada estudiante: si aparece en otra respuesta, hubo fuga. */
  retro: { e1: string; e2: string; f: string };
}

type Estudiante = 'e1' | 'e2' | 'f';
const ESTUDIANTES: Estudiante[] = ['e1', 'e2', 'f'];

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

function enviar(servidor: Server, metodo: 'get' | 'post' | 'put', ruta: string, token: string, cuerpo?: object, cabeceras: Record<string, string> = {}) {
  let peticion = request(servidor)[metodo](ruta).set('Authorization', token);
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    peticion = peticion.set(nombre, valor);
  }
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

export async function construirMundoNotas(servidor: Server): Promise<MundoNotas> {
  const crear = async (metodo: 'post' | 'put', ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Cuerpo> => {
    const respuesta = await enviar(servidor, metodo, ruta, token, cuerpo);
    if (respuesta.status !== (metodo === 'post' ? 201 : 200)) {
      throw new Error(`No se pudo preparar ${metodo.toUpperCase()} ${ruta}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
    }
    return respuesta.body as Cuerpo;
  };
  const post = (ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Cuerpo> => crear('post', ruta, cuerpo, token);
  const persona = async (tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<ActorNotas> => {
    const creada = await post('/personas', { id: randomUUID(), tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() });
    const usuarioId = String(creada.usuarioId);
    return { personaId: String(creada.id), usuarioId, token: `Bearer ${tokenValido([tipo], { sub: usuarioId })}` };
  };
  const cursoConTrimestre = async (): Promise<{ curso: string; trimestre: string; fin: string }> => {
    const anio = await post('/anios-lectivos', await ANIOS_LECTIVOS.cuerpoValido(post));
    const curso = await post('/cursos', { id: randomUUID(), anioLectivoId: anio.id, nivel: `Nivel ${palabraFicticia()} EGB`, paralelo: 'A' });
    const inicio = String(anio.inicio);
    const fin = `${inicio.slice(0, 4)}-11-30`;
    const trimestre = String((await post('/periodos', { id: randomUUID(), anioLectivoId: anio.id, numero: 1, inicio, fin })).id);
    return { curso: String(curso.id), trimestre, fin };
  };

  const a = await cursoConTrimestre();
  const b = await cursoConTrimestre();
  const materia1 = String((await post('/materias', await MATERIAS.cuerpoValido(post))).id);
  const materia2 = String((await post('/materias', await MATERIAS.cuerpoValido(post))).id);
  const [d1, d2, d3] = [await persona('DOCENTE'), await persona('DOCENTE'), await persona('DOCENTE')];
  const asignar = async (docente: ActorNotas, materia: string, curso: string): Promise<string> =>
    String((await post('/asignaciones', { docenteId: docente.personaId, materiaId: materia, cursoId: curso })).id);
  const asignacionA1 = await asignar(d1, materia1, a.curso);
  await asignar(d2, materia2, a.curso);
  const asignacionB1 = await asignar(d3, materia1, b.curso);

  const [e1, e2, f] = [await persona('ESTUDIANTE'), await persona('ESTUDIANTE'), await persona('ESTUDIANTE')];
  const [r1, r2, r12, rf] = [await persona('REPRESENTANTE'), await persona('REPRESENTANTE'), await persona('REPRESENTANTE'), await persona('REPRESENTANTE')];
  for (const [representante, estudiante] of [[r1, e1], [r2, e2], [r12, e1], [r12, e2], [rf, f]] as const) {
    await post('/representaciones', { estudianteId: estudiante.personaId, representanteId: representante.personaId, parentesco: 'Madre' });
  }
  const matricular = async (estudiante: ActorNotas, curso: string): Promise<string> =>
    String((await post('/matriculas', { estudianteId: estudiante.personaId, cursoId: curso }, SECRETARIA)).id);
  const matricula = { e1: await matricular(e1, a.curso), e2: await matricular(e2, a.curso), f: await matricular(f, b.curso) };

  // Calificación del trimestre 1 de cada estudiante, registrada por su docente
  const calificar = (docente: ActorNotas, asignacionId: string, matriculaId: string): Promise<Cuerpo> =>
    crear('put', '/calificaciones', { asignacionId, matriculaId, trimestre: 1, aportesBloque1: [8, 9], aportesBloque2: [7, 8], refuerzo: null, notaProyecto: 8, notaExamen: 9, version: 0 }, docente.token);
  await calificar(d1, asignacionA1, matricula.e1);
  await calificar(d1, asignacionA1, matricula.e2);
  await calificar(d3, asignacionB1, matricula.f);

  // Una tarea por curso, con la nota y una retroalimentación privada de cada estudiante
  const tarea = async (docente: ActorNotas, asignacionId: string, curso: { trimestre: string; fin: string }): Promise<string> =>
    String((await post('/tareas', { asignacionId, periodoId: curso.trimestre, tipo: 'TAREA', titulo: `Tarea ${palabraFicticia()}`, fechaEntrega: curso.fin }, docente.token)).id);
  const tareaA = await tarea(d1, asignacionA1, a);
  const tareaB = await tarea(d3, asignacionB1, b);
  const retro = { e1: `Privado de E1 ${randomUUID()}`, e2: `Privado de E2 ${randomUUID()}`, f: `Privado de F ${randomUUID()}` };
  const entrega = (docente: ActorNotas, tareaId: string, matriculaId: string, retroalimentacion: string): Promise<Cuerpo> =>
    crear('put', `/tareas/${tareaId}/entregas`, { matriculaId, nota: 8.5, retroalimentacion, version: 0 }, docente.token);
  await entrega(d1, tareaA, matricula.e1, retro.e1);
  await entrega(d1, tareaA, matricula.e2, retro.e2);
  await entrega(d3, tareaB, matricula.f, retro.f);

  return { asignacionA1, e1, e2, f, r1, r2, r12, rf, d1, d2, d3, matricula, tareaA, tareaB, retro };
}

/** Quién es cada actor y qué matrículas puede ver (sus notas o las de sus representados). */
interface PerfilLector {
  nombre: string;
  actor: (m: MundoNotas) => ActorNotas;
  propias: Estudiante[];
}

const LECTORES: PerfilLector[] = [
  { nombre: 'el estudiante E1', actor: (m) => m.e1, propias: ['e1'] },
  { nombre: 'el estudiante E2', actor: (m) => m.e2, propias: ['e2'] },
  { nombre: 'el estudiante F (otro curso)', actor: (m) => m.f, propias: ['f'] },
  { nombre: 'el representante de E1', actor: (m) => m.r1, propias: ['e1'] },
  { nombre: 'el representante de E2', actor: (m) => m.r2, propias: ['e2'] },
  { nombre: 'el representante de E1 y E2', actor: (m) => m.r12, propias: ['e1', 'e2'] },
  { nombre: 'el representante de F', actor: (m) => m.rf, propias: ['f'] },
];

/** 200 con exactamente esas matrículas, sin rastro de las demás (ids ni retroalimentaciones). */
function soloDe(respuesta: Response, m: MundoNotas, propias: Estudiante[]): void {
  expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
  const matriculas = new Set((respuesta.body as Cuerpo[]).map((c) => c.matriculaId));
  expect(matriculas).toEqual(new Set(propias.map((e) => m.matricula[e])));
  for (const ajeno of ESTUDIANTES.filter((e) => !propias.includes(e))) {
    expect(respuesta.text, `fuga de la matrícula de ${ajeno}`).not.toContain(m.matricula[ajeno]);
    expect(respuesta.text, `fuga de la retroalimentación de ${ajeno}`).not.toContain(m.retro[ajeno]);
  }
}

/** 403, o 200 solo con lo propio: para consultas donde ambas respuestas son seguras. */
function rechazoOSoloPropio(respuesta: Response, m: MundoNotas, propias: Estudiante[]): void {
  if (respuesta.status === 403) {
    esperarRechazo(respuesta, [403]);
    return;
  }
  if (respuesta.status === 400) {
    esperarRechazo(respuesta, [400]);
    return;
  }
  expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
  const matriculas = (respuesta.body as Cuerpo[]).map((c) => c.matriculaId);
  expect(matriculas.every((id) => propias.some((e) => m.matricula[e] === id))).toBe(true);
  for (const ajeno of ESTUDIANTES.filter((e) => !propias.includes(e))) {
    expect(respuesta.text).not.toContain(m.matricula[ajeno]);
    expect(respuesta.text).not.toContain(m.retro[ajeno]);
  }
}

export function verificarAccesoNotas(obtener: ObtenerServidor, mundo: () => MundoNotas): void {
  const get = (ruta: string, token: string, cabeceras?: Record<string, string>): Promise<Response> => enviar(obtener(), 'get', ruta, token, undefined, cabeceras);

  for (const lector of LECTORES) {
    describe(`Como ${lector.nombre}`, () => {
      it('ve sus calificaciones sin pedir filtro, y solo las suyas', async () => {
        const m = mundo();
        soloDe(await get('/calificaciones', lector.actor(m).token), m, lector.propias);
      });

      for (const propia of lector.propias) {
        it(`ve la calificación de ${propia.toUpperCase()} pidiéndola por matrícula`, async () => {
          const m = mundo();
          soloDe(await get(`/calificaciones?matriculaId=${m.matricula[propia]}`, lector.actor(m).token), m, [propia]);
        });
      }

      // Las notas de la tarea de su curso: solo las propias; la tarea de otro curso, 403
      const enA = lector.propias.filter((e) => e !== 'f');
      if (enA.length) {
        it('en la tarea de su curso ve solo su nota y su retroalimentación', async () => {
          const m = mundo();
          soloDe(await get(`/tareas/${m.tareaA}/entregas`, lector.actor(m).token), m, enA);
        });
        it('403 · las notas de la tarea del curso B', async () => {
          const m = mundo();
          esperarRechazo(await get(`/tareas/${m.tareaB}/entregas`, lector.actor(m).token), [403]);
        });
      } else {
        it('en la tarea de su curso ve solo su nota y su retroalimentación', async () => {
          const m = mundo();
          soloDe(await get(`/tareas/${m.tareaB}/entregas`, lector.actor(m).token), m, ['f']);
        });
        it('403 · las notas de la tarea del curso A', async () => {
          const m = mundo();
          esperarRechazo(await get(`/tareas/${m.tareaA}/entregas`, lector.actor(m).token), [403]);
        });
      }

      for (const ajeno of ESTUDIANTES.filter((e) => !lector.propias.includes(e))) {
        it(`403 · la calificación de ${ajeno.toUpperCase()} por matrícula`, async () => {
          const m = mundo();
          const respuesta = await get(`/calificaciones?matriculaId=${m.matricula[ajeno]}`, lector.actor(m).token);
          esperarRechazo(respuesta, [403]);
          expect(respuesta.text).not.toContain(m.retro[ajeno]);
        });
        it(`403 · la calificación de ${ajeno.toUpperCase()} en el trimestre 1`, async () => {
          const m = mundo();
          esperarRechazo(await get(`/calificaciones?matriculaId=${m.matricula[ajeno]}&trimestre=1`, lector.actor(m).token), [403]);
        });
      }

      it('403 · una matrícula inventada, idéntico al de una matrícula ajena (no se averigua quién existe)', async () => {
        const m = mundo();
        const ajeno = ESTUDIANTES.find((e) => !lector.propias.includes(e)) as Estudiante;
        const existente = await get(`/calificaciones?matriculaId=${m.matricula[ajeno]}`, lector.actor(m).token);
        const inventada = await get(`/calificaciones?matriculaId=${randomUUID()}`, lector.actor(m).token);

        esperarRechazo(existente, [403]);
        esperarRechazo(inventada, [403]);
        expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([existente.body.codigo, existente.body.mensaje]);
      });

      it('la libreta de la asignación A1 no le muestra a nadie más (403 o solo lo suyo)', async () => {
        const m = mundo();
        rechazoOSoloPropio(await get(`/calificaciones?asignacionId=${m.asignacionA1}`, lector.actor(m).token), m, lector.propias);
      });
    });
  }

  describe('Intentos de manipular la consulta (E1)', () => {
    it('403 · pedir A1 junto con la matrícula de E2', async () => {
      const m = mundo();
      esperarRechazo(await get(`/calificaciones?asignacionId=${m.asignacionA1}&matriculaId=${m.matricula.e2}`, m.e1.token), [403]);
    });

    it('la matrícula repetida (propia y ajena) se rechaza o devuelve solo la propia', async () => {
      const m = mundo();
      rechazoOSoloPropio(await get(`/calificaciones?matriculaId=${m.matricula.e1}&matriculaId=${m.matricula.e2}`, m.e1.token), m, ['e1']);
    });

    it('la matrícula de E2 en mayúsculas tampoco da acceso', async () => {
      const m = mundo();
      rechazoOSoloPropio(await get(`/calificaciones?matriculaId=${m.matricula.e2.toUpperCase()}`, m.e1.token), m, ['e1']);
    });

    it('cabeceras con la identidad de E2 no cambian quién es', async () => {
      const m = mundo();
      const respuesta = await get('/calificaciones', m.e1.token, {
        'X-Usuario-Id': m.e2.usuarioId,
        'X-User-Id': m.e2.usuarioId,
        'X-Forwarded-User': m.e2.usuarioId,
        'X-Estudiante-Id': m.e2.personaId,
        'X-Matricula-Id': m.matricula.e2,
      });
      soloDe(respuesta, m, ['e1']);
    });

    it('un parámetro usuarioId de E2 se rechaza o se ignora', async () => {
      const m = mundo();
      rechazoOSoloPropio(await get(`/calificaciones?usuarioId=${m.e2.usuarioId}&estudianteId=${m.e2.personaId}`, m.e1.token), m, ['e1']);
    });

    it('403 · E1 con su clave temporal pendiente no ve ni sus propias notas', async () => {
      const m = mundo();
      const pendiente = `Bearer ${tokenValido(['ESTUDIANTE'], { sub: m.e1.usuarioId, debe_cambiar_clave: true })}`;
      esperarRechazo(await get(`/calificaciones?matriculaId=${m.matricula.e1}`, pendiente), [403]);
      esperarRechazo(await get(`/tareas/${m.tareaA}/entregas`, pendiente), [403]);
    });

    it('403 · un token de E1 con el rol REPRESENTANTE no inventa vínculos con nadie', async () => {
      const m = mundo();
      const otroRol = `Bearer ${tokenValido(['REPRESENTANTE'], { sub: m.e1.usuarioId })}`;
      esperarRechazo(await get(`/calificaciones?matriculaId=${m.matricula.e2}`, otroRol), [403]);
      rechazoOSoloPropio(await get('/calificaciones', otroRol), m, []);
    });

    it('403 · un estudiante sin persona registrada no ve las notas de E1', async () => {
      const m = mundo();
      const sinPersona = `Bearer ${tokenValido(['ESTUDIANTE'], { sub: randomUUID() })}`;
      esperarRechazo(await get(`/calificaciones?matriculaId=${m.matricula.e1}`, sinPersona), [403]);
      esperarRechazo(await get(`/tareas/${m.tareaA}/entregas`, sinPersona), [403]);
      rechazoOSoloPropio(await get('/calificaciones', sinPersona), m, []);
    });
  });

  describe('Personal del colegio', () => {
    it('el docente de A1 ve las calificaciones y las notas de tarea de sus dos estudiantes (control)', async () => {
      const m = mundo();
      soloDe(await get(`/calificaciones?asignacionId=${m.asignacionA1}`, m.d1.token), m, ['e1', 'e2']);
      soloDe(await get(`/tareas/${m.tareaA}/entregas`, m.d1.token), m, ['e1', 'e2']);
    });

    const ajenos: [string, (m: MundoNotas) => string][] = [
      ['el docente de otra materia del mismo curso', (m) => m.d2.token],
      ['el docente del curso B', (m) => m.d3.token],
      ['la secretaría', () => SECRETARIA],
    ];
    for (const [nombre, token] of ajenos) {
      it(`403 · ${nombre} pide la libreta de A1`, async () => {
        const m = mundo();
        esperarRechazo(await get(`/calificaciones?asignacionId=${m.asignacionA1}`, token(m)), [403]);
      });
      it(`403 · ${nombre} pide las notas de la tarea de A1`, async () => {
        const m = mundo();
        const respuesta = await get(`/tareas/${m.tareaA}/entregas`, token(m));
        esperarRechazo(respuesta, [403]);
        expect(respuesta.text).not.toContain(m.retro.e1);
      });
    }

    it('403 · la secretaría pide calificaciones por matrícula o sin filtro', async () => {
      const m = mundo();
      esperarRechazo(await get(`/calificaciones?matriculaId=${m.matricula.e1}`, SECRETARIA), [403]);
      esperarRechazo(await get('/calificaciones', SECRETARIA), [403]);
    });

    it('el docente del curso B no ve en su libreta a los estudiantes del curso A', async () => {
      const m = mundo();
      rechazoOSoloPropio(await get('/calificaciones', m.d3.token), m, ['f']);
    });
  });
}
