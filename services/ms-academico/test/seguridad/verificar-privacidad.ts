import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { Cuerpo, CURSOS } from './endpoints-academicos';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';
import { tokenDeServicio, tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Suite de privacidad (RNF-04, T1111-A): un estudiante o un representante solo ve sus propios datos.
// Arma por la API dos familias y luego prueba, con el token de cada persona, que nadie llega a lo ajeno:
//
//   curso X: estudiante A (representado por RA y por RAC) y estudiante B (representado por RB)
//   curso Y: estudiante C (representado por RAC)
//
// Se aplica igual a la implementación de referencia y a los endpoints reales.

export interface Actor {
  personaId: string;
  usuarioId: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  token: string;
}

export interface Mundo {
  cursoX: string;
  cursoY: string;
  estudianteA: Actor;
  estudianteB: Actor;
  estudianteC: Actor;
  representanteA: Actor;
  representanteB: Actor;
  representanteAC: Actor;
  /** Respuestas de las altas, para revisar que ninguna devolvió la cédula. */
  respuestasDeAlta: string[];
}

type Metodo = 'get' | 'post';
const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

async function enviar(servidor: Server, metodo: Metodo, ruta: string, token: string, cuerpo?: object, cabeceras: Record<string, string> = {}): Promise<Response> {
  let peticion = request(servidor)[metodo](ruta).set('Authorization', token);
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    peticion = peticion.set(nombre, valor);
  }
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

async function crear(servidor: Server, ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Response> {
  const respuesta = await enviar(servidor, 'post', ruta, token, cuerpo);
  if (respuesta.status !== 201) {
    throw new Error(`No se pudo preparar ${ruta}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
  }
  return respuesta;
}

/** Crea las personas, representaciones y matrículas del escenario con el personal del colegio. */
export async function construirMundo(servidor: Server): Promise<Mundo> {
  const respuestasDeAlta: string[] = [];
  const crearRecurso = async (ruta: string, cuerpo: Cuerpo): Promise<Cuerpo> => (await crear(servidor, ruta, cuerpo)).body as Cuerpo;

  const cursoX = String((await crearRecurso('/cursos', await CURSOS.cuerpoValido(crearRecurso))).id);
  const cursoY = String((await crearRecurso('/cursos', await CURSOS.cuerpoValido(crearRecurso))).id);

  const persona = async (tipo: 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<Actor> => {
    const datos = { id: randomUUID(), tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() };
    const respuesta = await crear(servidor, '/personas', datos);
    respuestasDeAlta.push(respuesta.text);
    const usuarioId = String(respuesta.body.usuarioId);
    return { personaId: String(respuesta.body.id), usuarioId, nombres: datos.nombres, apellidos: datos.apellidos, cedula: datos.cedula, token: `Bearer ${tokenValido([tipo], { sub: usuarioId })}` };
  };
  const [estudianteA, estudianteB, estudianteC] = [await persona('ESTUDIANTE'), await persona('ESTUDIANTE'), await persona('ESTUDIANTE')];
  const [representanteA, representanteB, representanteAC] = [await persona('REPRESENTANTE'), await persona('REPRESENTANTE'), await persona('REPRESENTANTE')];

  const representa = async (representante: Actor, estudiante: Actor): Promise<void> => {
    await crear(servidor, '/representaciones', { estudianteId: estudiante.personaId, representanteId: representante.personaId, parentesco: 'Madre' });
  };
  await representa(representanteA, estudianteA);
  await representa(representanteB, estudianteB);
  await representa(representanteAC, estudianteA);
  await representa(representanteAC, estudianteC);

  // La matrícula la hace la secretaría (RF-04)
  await crear(servidor, '/matriculas', { estudianteId: estudianteA.personaId, cursoId: cursoX }, SECRETARIA);
  await crear(servidor, '/matriculas', { estudianteId: estudianteB.personaId, cursoId: cursoX }, SECRETARIA);
  await crear(servidor, '/matriculas', { estudianteId: estudianteC.personaId, cursoId: cursoY }, SECRETARIA);

  return { cursoX, cursoY, estudianteA, estudianteB, estudianteC, representanteA, representanteB, representanteAC, respuestasDeAlta };
}

/** Ningún rastro de esas personas en la respuesta: ni ids, ni nombres, ni cédula. */
function noMenciona(respuesta: Response, ...ajenos: Actor[]): void {
  for (const ajeno of ajenos) {
    for (const dato of [ajeno.personaId, ajeno.usuarioId, ajeno.nombres, ajeno.apellidos, ajeno.cedula]) {
      expect(respuesta.text, `la respuesta revela datos de otra persona (${dato})`).not.toContain(dato);
    }
  }
}

/** 200 con matrículas solo de esos estudiantes (y al menos una), o lo que se indique. */
function soloMatriculasDe(respuesta: Response, ...estudiantes: Actor[]): void {
  expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
  const ids = (respuesta.body as Cuerpo[]).map((m) => m.estudianteId);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids)).toEqual(new Set(estudiantes.map((e) => e.personaId)));
}

/** Una lista que no puede incluir a nadie ajeno: 403, o 200 sin rastro de ellos. */
function listaSinAjenos(respuesta: Response, ...ajenos: Actor[]): void {
  expect([200, 403], respuesta.text.slice(0, 300)).toContain(respuesta.status);
  if (respuesta.status === 403) {
    esperarRechazo(respuesta, [403]);
  }
  noMenciona(respuesta, ...ajenos);
}

export function verificarPrivacidad(obtener: ObtenerServidor, mundo: () => Mundo): void {
  const get = (ruta: string, actor: Actor | string, cabeceras?: Record<string, string>): Promise<Response> =>
    enviar(obtener(), 'get', ruta, typeof actor === 'string' ? actor : actor.token, undefined, cabeceras);
  const post = (ruta: string, actor: Actor | string, cuerpo: object): Promise<Response> =>
    enviar(obtener(), 'post', ruta, typeof actor === 'string' ? actor : actor.token, cuerpo);

  describe('Personal del colegio (control: el escenario existe y es visible para quien corresponde)', () => {
    it('la secretaría ve la nómina completa del curso X', async () => {
      const m = mundo();
      soloMatriculasDe(await get(`/matriculas?cursoId=${m.cursoX}`, SECRETARIA), m.estudianteA, m.estudianteB);
    });

    it('el administrador ve a todos los estudiantes', async () => {
      const m = mundo();
      const respuesta = await get('/personas?tipo=ESTUDIANTE', ADMIN);
      expect(respuesta.status).toBe(200);
      const ids = (respuesta.body as Cuerpo[]).map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining([m.estudianteA, m.estudianteB, m.estudianteC].map((e) => e.personaId)));
    });
  });

  describe('GET /matriculas como estudiante', () => {
    it('sin filtro, el estudiante A solo recibe su propia matrícula', async () => {
      const m = mundo();
      const respuesta = await get('/matriculas', m.estudianteA);
      soloMatriculasDe(respuesta, m.estudianteA);
      noMenciona(respuesta, m.estudianteB, m.estudianteC);
    });

    it('A puede pedir su matrícula por su id', async () => {
      const m = mundo();
      soloMatriculasDe(await get(`/matriculas?estudianteId=${m.estudianteA.personaId}`, m.estudianteA), m.estudianteA);
    });

    it('403 si A pide la matrícula de su compañero B', async () => {
      const m = mundo();
      const respuesta = await get(`/matriculas?estudianteId=${m.estudianteB.personaId}`, m.estudianteA);
      esperarRechazo(respuesta, [403]);
      noMenciona(respuesta, m.estudianteB);
    });

    it('403 si C pide la matrícula de A, de otro curso', async () => {
      const m = mundo();
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteA.personaId}`, m.estudianteC), [403]);
    });

    it('403 idéntico para un estudiante que existe y uno inventado (no se puede averiguar quién está matriculado)', async () => {
      const m = mundo();
      const existente = await get(`/matriculas?estudianteId=${m.estudianteB.personaId}`, m.estudianteA);
      const inventado = await get(`/matriculas?estudianteId=${randomUUID()}`, m.estudianteA);

      esperarRechazo(existente, [403]);
      esperarRechazo(inventado, [403]);
      expect([inventado.body.codigo, inventado.body.mensaje]).toEqual([existente.body.codigo, existente.body.mensaje]);
    });

    it('la nómina de su propio curso no le muestra a los compañeros (403 o solo su matrícula)', async () => {
      const m = mundo();
      const respuesta = await get(`/matriculas?cursoId=${m.cursoX}`, m.estudianteA);
      listaSinAjenos(respuesta, m.estudianteB);
    });

    it('no cambia de identidad con cabeceras inventadas', async () => {
      const m = mundo();
      const respuesta = await get('/matriculas', m.estudianteA, {
        'X-Usuario-Id': m.estudianteB.usuarioId,
        'X-User-Id': m.estudianteB.usuarioId,
        'X-Forwarded-User': m.estudianteB.usuarioId,
        'X-Auth-Request-User': m.estudianteB.usuarioId,
        'X-Estudiante-Id': m.estudianteB.personaId,
      });
      soloMatriculasDe(respuesta, m.estudianteA);
    });

    it('no cambia de identidad con un parámetro usuarioId (400 o solo lo suyo)', async () => {
      const m = mundo();
      const respuesta = await get(`/matriculas?usuarioId=${m.estudianteB.usuarioId}`, m.estudianteA);
      if (respuesta.status === 400) {
        esperarRechazo(respuesta, [400]);
        return;
      }
      soloMatriculasDe(respuesta, m.estudianteA);
    });

    it('un estudiante sin persona registrada no ve matrículas de nadie', async () => {
      const m = mundo();
      const sinPersona = `Bearer ${tokenValido(['ESTUDIANTE'], { sub: randomUUID() })}`;
      const respuesta = await get('/matriculas', sinPersona);
      expect([200, 403]).toContain(respuesta.status);
      if (respuesta.status === 200) {
        expect(respuesta.body).toEqual([]);
      }
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteA.personaId}`, sinPersona), [403]);
    });
  });

  describe('GET /matriculas como representante', () => {
    it('el representante de A solo recibe la matrícula de A', async () => {
      const m = mundo();
      const respuesta = await get('/matriculas', m.representanteA);
      soloMatriculasDe(respuesta, m.estudianteA);
      noMenciona(respuesta, m.estudianteB, m.estudianteC);
    });

    it('403 si el representante de A pide la matrícula de B', async () => {
      const m = mundo();
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteB.personaId}`, m.representanteA), [403]);
    });

    it('403 si el representante de B pide la matrícula de A', async () => {
      const m = mundo();
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteA.personaId}`, m.representanteB), [403]);
    });

    it('con dos representados ve a ambos y a nadie más', async () => {
      const m = mundo();
      const respuesta = await get('/matriculas', m.representanteAC);
      soloMatriculasDe(respuesta, m.estudianteA, m.estudianteC);
      noMenciona(respuesta, m.estudianteB);
    });

    it('403 si el representante de A y C pide la matrícula de B', async () => {
      const m = mundo();
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteB.personaId}`, m.representanteAC), [403]);
    });

    it('la nómina del curso de su representado no le muestra a los demás (403 o solo lo suyo)', async () => {
      const m = mundo();
      listaSinAjenos(await get(`/matriculas?cursoId=${m.cursoX}`, m.representanteA), m.estudianteB);
    });
  });

  describe('GET /personas', () => {
    it('el estudiante A no ve a otros estudiantes ni a sus familias (403 o solo su círculo)', async () => {
      const m = mundo();
      for (const tipo of ['ESTUDIANTE', 'REPRESENTANTE']) {
        listaSinAjenos(await get(`/personas?tipo=${tipo}`, m.estudianteA), m.estudianteB, m.estudianteC, m.representanteB);
      }
    });

    it('buscar por el apellido de B no lo encuentra', async () => {
      const m = mundo();
      listaSinAjenos(await get(`/personas?q=${encodeURIComponent(m.estudianteB.apellidos)}`, m.estudianteA), m.estudianteB);
    });

    it('el representante de A no ve a B, a C ni a la familia de B', async () => {
      const m = mundo();
      listaSinAjenos(await get('/personas?tipo=ESTUDIANTE', m.representanteA), m.estudianteB, m.estudianteC, m.representanteB);
      listaSinAjenos(await get('/personas', m.representanteA), m.estudianteB, m.estudianteC, m.representanteB);
    });

    it('nadie, ni el administrador, recibe la cédula', async () => {
      const m = mundo();
      const todos = [m.estudianteA, m.estudianteB, m.estudianteC, m.representanteA, m.representanteB, m.representanteAC];
      const listados = [await get('/personas', ADMIN), await get('/personas', m.estudianteA), await get('/personas', m.representanteAC)];
      for (const texto of [...m.respuestasDeAlta, ...listados.map((r) => r.text)]) {
        expect(texto).not.toMatch(/"cedula"/i);
        for (const persona of todos) {
          expect(texto).not.toContain(persona.cedula);
        }
      }
    });
  });

  describe('Escrituras: solo el personal del colegio matricula y vincula', () => {
    const actores: [string, (m: Mundo) => Actor | string][] = [
      ['el estudiante A', (m) => m.estudianteA],
      ['el representante de A', (m) => m.representanteA],
      ['un docente', () => `Bearer ${tokenValido(['DOCENTE'])}`],
    ];
    const intentos: [string, string, (m: Mundo) => object][] = [
      ['matricular a A en otro curso', '/matriculas', (m) => ({ estudianteId: m.estudianteA.personaId, cursoId: m.cursoY })],
      ['vincularse como representante de B', '/representaciones', (m) => ({ estudianteId: m.estudianteB.personaId, representanteId: m.representanteA.personaId, parentesco: 'Padre' })],
      ['registrar una persona', '/personas', () => ({ tipo: 'ESTUDIANTE', nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() })],
    ];
    for (const [nombreActor, actor] of actores) {
      for (const [accion, ruta, cuerpo] of intentos) {
        it(`403 si ${nombreActor} intenta ${accion}`, async () => {
          const m = mundo();
          esperarRechazo(await post(ruta, actor(m), cuerpo(m)), [403]);
        });
      }
    }

    it('el intento rechazado no le dio acceso: el representante de A sigue sin ver a B', async () => {
      const m = mundo();
      await post('/representaciones', m.representanteA, { estudianteId: m.estudianteB.personaId, representanteId: m.representanteA.personaId, parentesco: 'Padre' });
      esperarRechazo(await get(`/matriculas?estudianteId=${m.estudianteB.personaId}`, m.representanteA), [403]);
    });
  });

  describe('Tokens que no son de una persona', () => {
    it('un token de servicio no lee matrículas (401 o 403)', async () => {
      const respuesta = await get('/matriculas', `Bearer ${tokenDeServicio()}`);
      esperarRechazo(respuesta, [401, 403]);
    });
  });
}
