import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import request, { Response } from 'supertest';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';
import { ANIOS_LECTIVOS, Cuerpo, MATERIAS } from './endpoints-academicos';
import { tokensRechazados, tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Suite de calificaciones (RF-17, RF-18, T1118-A):
//  1. Exactitud: cada fila de la hoja oficial anonimizada (packages/calculo-notas/casos, T1117-A) se registra
//     por PUT /calificaciones y la nota final y el cualitativo que calcula el SERVIDOR deben coincidir con el
//     libro oficial. Así se comprueba que el servidor recalcula con el paquete compartido (RNF-02).
//  2. Permisos: solo el docente asignado a esa materia en ese curso califica; nadie más, ni el administrador.
//  3. Lectura: el docente ve su asignación; el estudiante y el representante, solo lo suyo; la secretaría, nada.
//
// Escenario armado por la API:
//   curso A: materia M1 (docente D1, el que califica) y materia M2 (docente D2); estudiantes de la hoja,
//            estudiante E (de control) con su representante R
//   curso B: materia M1 (docente D3); estudiante F
// Se aplica igual a la implementación de referencia y a los endpoints reales.

const HOJA = resolve(__dirname, '../../../../packages/calculo-notas/casos/hoja-oficial-anonimizada.json');

type Nota = number | null;

interface FilaHoja {
  id: string;
  descripcion: string;
  entrada: { aportesBloque1: Nota[]; aportesBloque2: Nota[]; refuerzo: Nota; notaProyecto: Nota; notaExamen: Nota };
  esperado: { notaFinal: Nota; cualitativo: string | null };
}

export interface CasoServidor {
  id: string;
  descripcion: string;
  /** Cuerpo de PUT /calificaciones sin asignación, matrícula, trimestre ni versión. */
  aportes: { aportesBloque1: number[]; aportesBloque2: number[]; refuerzo: number | null; notaProyecto: number; notaExamen: number };
  notaFinal: number;
  cualitativo: string;
}

/**
 * Filas de la hoja que se pueden registrar por la API: el contrato exige proyecto y examen, y las celdas
 * vacías de aportes se omiten del arreglo (el promedio del libro tampoco las cuenta).
 */
export function casosParaServidor(): CasoServidor[] {
  const hoja = JSON.parse(readFileSync(HOJA, 'utf8')) as { casos: FilaHoja[] };
  const presentes = (notas: Nota[]): number[] => notas.filter((n): n is number => n !== null);
  return hoja.casos
    .filter((c) => c.entrada.notaProyecto !== null && c.entrada.notaExamen !== null && c.esperado.notaFinal !== null)
    .map((c) => ({
      id: c.id,
      descripcion: c.descripcion,
      aportes: {
        aportesBloque1: presentes(c.entrada.aportesBloque1),
        aportesBloque2: presentes(c.entrada.aportesBloque2),
        refuerzo: c.entrada.refuerzo,
        notaProyecto: c.entrada.notaProyecto as number,
        notaExamen: c.entrada.notaExamen as number,
      },
      notaFinal: c.esperado.notaFinal as number,
      cualitativo: c.esperado.cualitativo as string,
    }));
}

export interface ActorCalificaciones {
  personaId: string;
  usuarioId: string;
  token: string;
}

export interface MundoCalificaciones {
  cursoA: string;
  cursoB: string;
  /** Docente de M1 en el curso A: el único que califica la asignación A1. */
  docenteMateria: ActorCalificaciones;
  /** Docente de M2 en el mismo curso A. */
  docenteOtraMateria: ActorCalificaciones;
  /** Docente de M1 en el curso B. */
  docenteOtroCurso: ActorCalificaciones;
  asignacionA1: string;
  asignacionA2: string;
  asignacionB1: string;
  estudianteControl: ActorCalificaciones;
  matriculaControl: string;
  representanteControl: ActorCalificaciones;
  estudianteOtroCurso: ActorCalificaciones;
  matriculaOtroCurso: string;
  /** Matrículas del curso A para los casos de la hoja: cada una admite 3 trimestres. */
  matriculasHoja: string[];
}

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

function enviar(servidor: Server, metodo: 'get' | 'post' | 'put', ruta: string, token: string | undefined, cuerpo?: object, cabeceras: Record<string, string> = {}) {
  let peticion = request(servidor)[metodo](ruta);
  if (token !== undefined) {
    peticion = peticion.set('Authorization', token);
  }
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    peticion = peticion.set(nombre, valor);
  }
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/** Arma el escenario con el personal del colegio. `estudiantesHoja` matrículas reciben los casos de la hoja. */
export async function construirMundoCalificaciones(servidor: Server, estudiantesHoja: number): Promise<MundoCalificaciones> {
  const crear = async (ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Cuerpo> => {
    const respuesta = await enviar(servidor, 'post', ruta, token, cuerpo);
    if (respuesta.status !== 201) {
      throw new Error(`No se pudo preparar ${ruta}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
    }
    return respuesta.body as Cuerpo;
  };
  const persona = async (tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<ActorCalificaciones> => {
    const creada = await crear('/personas', { id: randomUUID(), tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() });
    const usuarioId = String(creada.usuarioId);
    return { personaId: String(creada.id), usuarioId, token: `Bearer ${tokenValido([tipo], { sub: usuarioId })}` };
  };
  const matricular = async (estudiante: ActorCalificaciones, cursoId: string): Promise<string> =>
    String((await crear('/matriculas', { estudianteId: estudiante.personaId, cursoId }, SECRETARIA)).id);
  const asignar = async (docente: ActorCalificaciones, materiaId: string, cursoId: string): Promise<string> =>
    String((await crear('/asignaciones', { docenteId: docente.personaId, materiaId, cursoId })).id);

  // Cada curso va en su año lectivo con los tres trimestres: el servidor real rechaza las notas de un
  // trimestre que no está definido (400) y las de uno cerrado (409, RN-18)
  const cursoConTrimestres = async (): Promise<string> => {
    const anio = await crear('/anios-lectivos', await ANIOS_LECTIVOS.cuerpoValido(crear));
    const curso = await crear('/cursos', { id: randomUUID(), anioLectivoId: anio.id, nivel: `Nivel ${palabraFicticia()} EGB`, paralelo: 'A' });
    const año = Number(String(anio.inicio).slice(0, 4));
    const trimestres: [number, string, string][] = [
      [1, `${año}-09-01`, `${año}-11-30`],
      [2, `${año}-12-01`, `${año + 1}-03-31`],
      [3, `${año + 1}-04-01`, String(anio.fin)],
    ];
    for (const [numero, inicio, fin] of trimestres) {
      await crear('/periodos', { id: randomUUID(), anioLectivoId: anio.id, numero, inicio, fin });
    }
    return String(curso.id);
  };
  const cursoA = await cursoConTrimestres();
  const cursoB = await cursoConTrimestres();
  const materia1 = String((await crear('/materias', await MATERIAS.cuerpoValido(crear))).id);
  const materia2 = String((await crear('/materias', await MATERIAS.cuerpoValido(crear))).id);

  const [docenteMateria, docenteOtraMateria, docenteOtroCurso] = [await persona('DOCENTE'), await persona('DOCENTE'), await persona('DOCENTE')];
  const asignacionA1 = await asignar(docenteMateria, materia1, cursoA);
  const asignacionA2 = await asignar(docenteOtraMateria, materia2, cursoA);
  const asignacionB1 = await asignar(docenteOtroCurso, materia1, cursoB);

  const estudianteControl = await persona('ESTUDIANTE');
  const representanteControl = await persona('REPRESENTANTE');
  await crear('/representaciones', { estudianteId: estudianteControl.personaId, representanteId: representanteControl.personaId, parentesco: 'Madre' });
  const matriculaControl = await matricular(estudianteControl, cursoA);
  const estudianteOtroCurso = await persona('ESTUDIANTE');
  const matriculaOtroCurso = await matricular(estudianteOtroCurso, cursoB);

  const matriculasHoja: string[] = [];
  for (let i = 0; i < estudiantesHoja; i++) {
    matriculasHoja.push(await matricular(await persona('ESTUDIANTE'), cursoA));
  }

  return {
    cursoA,
    cursoB,
    docenteMateria,
    docenteOtraMateria,
    docenteOtroCurso,
    asignacionA1,
    asignacionA2,
    asignacionB1,
    estudianteControl,
    matriculaControl,
    representanteControl,
    estudianteOtroCurso,
    matriculaOtroCurso,
    matriculasHoja,
  };
}

/** Aportes válidos cualquiera para las pruebas de permisos. */
const APORTES_CONTROL = { aportesBloque1: [8, 9, 8.5, 8.5, 9], aportesBloque2: [8, 8, 9, 8, 9], refuerzo: null, notaProyecto: 9, notaExamen: 8.5 };

export function verificarCalificaciones(obtener: ObtenerServidor, mundo: () => MundoCalificaciones, casos: CasoServidor[]): void {
  const put = (actor: ActorCalificaciones | string | undefined, cuerpo: object, cabeceras?: Record<string, string>): Promise<Response> =>
    enviar(obtener(), 'put', '/calificaciones', typeof actor === 'object' ? actor.token : actor, cuerpo, cabeceras);
  const get = (consulta: string, actor: ActorCalificaciones | string): Promise<Response> =>
    enviar(obtener(), 'get', `/calificaciones${consulta}`, typeof actor === 'object' ? actor.token : actor);
  /** Calificación del estudiante de control en la asignación A1 (o la indicada). */
  const cuerpoControl = (m: MundoCalificaciones, cambios: object = {}): object => ({
    asignacionId: m.asignacionA1,
    matriculaId: m.matriculaControl,
    trimestre: 3,
    ...APORTES_CONTROL,
    version: 0,
    ...cambios,
  });

  describe('Exactitud: el servidor calcula igual que el libro oficial (RNF-02, I-05)', () => {
    // Cada caso ocupa una matrícula y un trimestre propios del curso A
    const ranura = (indice: number): { matricula: number; trimestre: number } => ({ matricula: indice % mundo().matriculasHoja.length, trimestre: Math.floor(indice / mundo().matriculasHoja.length) + 1 });

    it.each(casos.map((caso, indice) => ({ ...caso, indice })))('$id · $descripcion', async ({ aportes, notaFinal, cualitativo, indice }) => {
      const m = mundo();
      const { matricula, trimestre } = ranura(indice);
      const respuesta = await put(m.docenteMateria, { asignacionId: m.asignacionA1, matriculaId: m.matriculasHoja[matricula], trimestre, ...aportes, version: 0 });

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body.notaFinal, 'nota final').toBe(notaFinal);
      expect(respuesta.body.cualitativo, 'cualitativo').toBe(cualitativo);
    });

    it('lo guardado coincide con lo calculado: la libreta del docente devuelve las mismas notas', async () => {
      const m = mundo();
      const respuesta = await get(`?asignacionId=${m.asignacionA1}`, m.docenteMateria);
      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);

      const guardadas = new Map((respuesta.body as Cuerpo[]).map((c) => [`${String(c.matriculaId)}:${String(c.trimestre)}`, c]));
      casos.forEach((caso, indice) => {
        const { matricula, trimestre } = ranura(indice);
        const guardada = guardadas.get(`${m.matriculasHoja[matricula]}:${trimestre}`);
        expect(guardada, caso.id).toBeDefined();
        expect([guardada?.notaFinal, guardada?.cualitativo], caso.id).toEqual([caso.notaFinal, caso.cualitativo]);
      });
    });

    it('el cliente no impone la nota: una nota final enviada se rechaza o se ignora', async () => {
      const m = mundo();
      const aportesBajos = { aportesBloque1: [5, 5], aportesBloque2: [5, 5], refuerzo: null, notaProyecto: 5, notaExamen: 5 };
      const respuesta = await put(m.docenteMateria, { ...cuerpoControl(m, { trimestre: 1, ...aportesBajos }), notaFinal: 10, cualitativo: 'A+' });

      if (respuesta.status !== 200) {
        esperarRechazo(respuesta, [400]);
        return;
      }
      expect([respuesta.body.notaFinal, respuesta.body.cualitativo]).toEqual([5, 'C-']);
    });
  });

  describe('Permisos: solo el docente de la materia califica (RF-17)', () => {
    it('el docente de M1 en el curso A califica a su estudiante (control)', async () => {
      const m = mundo();
      const respuesta = await put(m.docenteMateria, cuerpoControl(m));

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toMatchObject({ asignacionId: m.asignacionA1, matriculaId: m.matriculaControl, trimestre: 3, notaFinal: 8.57, cualitativo: 'B+' });
    });

    const ajenos: [string, (m: MundoCalificaciones) => ActorCalificaciones | string][] = [
      ['el docente de otra materia del mismo curso', (m) => m.docenteOtraMateria],
      ['el docente de la misma materia en otro curso', (m) => m.docenteOtroCurso],
      ['el administrador', () => ADMIN],
      ['la secretaría', () => SECRETARIA],
      ['el propio estudiante', (m) => m.estudianteControl],
      ['su representante', (m) => m.representanteControl],
      ['un docente sin persona registrada', () => `Bearer ${tokenValido(['DOCENTE'], { sub: randomUUID() })}`],
      ['el docente de M1 si aún no cambia su clave temporal', (m) => `Bearer ${tokenValido(['DOCENTE'], { sub: m.docenteMateria.usuarioId, debe_cambiar_clave: true })}`],
    ];
    for (const [nombre, actor] of ajenos) {
      it(`403 si califica ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await put(actor(m), cuerpoControl(m, { trimestre: 2 })), [403]);
      });
    }

    for (const token of tokensRechazados()) {
      it(`401 con token ${token.nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await put(token.cabecera, cuerpoControl(m, { trimestre: 2 })), [401]);
      });
    }

    it('403 idéntico para una asignación ajena y una inventada (no se puede averiguar cuáles existen)', async () => {
      const m = mundo();
      const ajena = await put(m.docenteMateria, cuerpoControl(m, { asignacionId: m.asignacionA2, trimestre: 2 }));
      const inventada = await put(m.docenteMateria, cuerpoControl(m, { asignacionId: randomUUID(), trimestre: 2 }));

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });

    it('el docente de M1 del curso B no califica la asignación del curso A aunque sea la misma materia', async () => {
      const m = mundo();
      esperarRechazo(await put(m.docenteOtroCurso, cuerpoControl(m, { trimestre: 2 })), [403]);
    });

    it('se rechaza calificar con la propia asignación a un estudiante de otro curso', async () => {
      const m = mundo();
      esperarRechazo(await put(m.docenteMateria, cuerpoControl(m, { matriculaId: m.matriculaOtroCurso, trimestre: 2 })), [400, 403, 404, 422]);
    });

    it('un docente ajeno no se hace pasar por el de la materia con campos ni cabeceras inventadas', async () => {
      const m = mundo();
      const respuesta = await put(m.docenteOtraMateria, { ...cuerpoControl(m, { trimestre: 2 }), docenteId: m.docenteMateria.personaId }, {
        'X-Usuario-Id': m.docenteMateria.usuarioId,
        'X-User-Id': m.docenteMateria.usuarioId,
        'X-Forwarded-User': m.docenteMateria.usuarioId,
        'X-Docente-Id': m.docenteMateria.personaId,
      });
      esperarRechazo(respuesta, [400, 403]);
    });

    it('nadie más que el docente de la materia cambió la nota del estudiante de control', async () => {
      const m = mundo();
      const respuesta = await get(`?asignacionId=${m.asignacionA1}&matriculaId=${m.matriculaControl}&trimestre=2`, m.docenteMateria);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toEqual([]);
    });
  });

  describe('Versiones y datos de entrada', () => {
    it('409 si se guarda sobre una versión vieja; con la versión vigente se guarda', async () => {
      const m = mundo();
      // Versión vigente de la calificación del trimestre 1 (0 si todavía no existe)
      const actual = await get(`?asignacionId=${m.asignacionA1}&matriculaId=${m.matriculaControl}&trimestre=1`, m.docenteMateria);
      expect(actual.status, actual.text.slice(0, 300)).toBe(200);
      const version = Number((actual.body as Cuerpo[])[0]?.version ?? 0);

      const primera = await put(m.docenteMateria, cuerpoControl(m, { trimestre: 1, version }));
      expect(primera.status, primera.text.slice(0, 300)).toBe(200);
      // Otro dispositivo guarda sobre la versión que ya no es la vigente
      esperarRechazo(await put(m.docenteMateria, cuerpoControl(m, { trimestre: 1, version })), [409]);

      const vigente = await put(m.docenteMateria, cuerpoControl(m, { trimestre: 1, version: primera.body.version, notaExamen: 10 }));
      expect(vigente.status, vigente.text.slice(0, 300)).toBe(200);
      expect(vigente.body.version).toBeGreaterThan(primera.body.version);
    });

    const invalidos: [string, object][] = [
      ['un aporte mayor que 10', { aportesBloque1: [11, 8, 8, 8, 8] }],
      ['un aporte negativo', { aportesBloque2: [8, -1, 8, 8, 8] }],
      ['un aporte como texto', { aportesBloque1: ['8', 8, 8, 8, 8] }],
      ['un aporte nulo dentro de la lista', { aportesBloque1: [8, null, 8, 8, 8] }],
      ['más de 5 aportes en un bloque', { aportesBloque1: [8, 8, 8, 8, 8, 8] }],
      ['aportes que no son una lista', { aportesBloque1: { $ne: null } }],
      ['proyecto mayor que 10', { notaProyecto: 10.5 }],
      ['examen como texto', { notaExamen: '9' }],
      ['refuerzo negativo', { refuerzo: -2 }],
      ['trimestre 0', { trimestre: 0 }],
      ['trimestre 4', { trimestre: 4 }],
      ['trimestre como texto', { trimestre: '1' }],
      ['sin examen', { notaExamen: undefined }],
      ['asignación que no es UUID', { asignacionId: "' OR '1'='1" }],
    ];
    for (const [nombre, cambios] of invalidos) {
      it(`400 con ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await put(m.docenteMateria, cuerpoControl(m, { trimestre: 2, ...cambios })), [400]);
      });
    }
  });

  describe('Lectura de la libreta (RF-18, RNF-04)', () => {
    it('el docente de la materia ve las notas de su asignación', async () => {
      const m = mundo();
      const respuesta = await get(`?asignacionId=${m.asignacionA1}&matriculaId=${m.matriculaControl}`, m.docenteMateria);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect((respuesta.body as Cuerpo[]).length).toBeGreaterThan(0);
    });

    it('403 si el docente de otra materia pide la libreta de M1', async () => {
      const m = mundo();
      esperarRechazo(await get(`?asignacionId=${m.asignacionA1}`, m.docenteOtraMateria), [403]);
    });

    it('403 para la secretaría (contrato de GET /calificaciones)', async () => {
      const m = mundo();
      esperarRechazo(await get(`?asignacionId=${m.asignacionA1}`, SECRETARIA), [403]);
    });

    it('el estudiante ve solo sus notas, sin pedir filtro', async () => {
      const m = mundo();
      const respuesta = await get('', m.estudianteControl);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      const matriculas = new Set((respuesta.body as Cuerpo[]).map((c) => c.matriculaId));
      expect([...matriculas]).toEqual([m.matriculaControl]);
    });

    it('403 si el estudiante pide las notas de un compañero', async () => {
      const m = mundo();
      esperarRechazo(await get(`?matriculaId=${m.matriculasHoja[0]}`, m.estudianteControl), [403]);
    });

    it('el representante ve las notas de su representado y no las de otro', async () => {
      const m = mundo();
      const propias = await get(`?matriculaId=${m.matriculaControl}`, m.representanteControl);
      expect(propias.status, propias.text.slice(0, 300)).toBe(200);
      expect((propias.body as Cuerpo[]).every((c) => c.matriculaId === m.matriculaControl)).toBe(true);
      expect((propias.body as Cuerpo[]).length).toBeGreaterThan(0);

      esperarRechazo(await get(`?matriculaId=${m.matriculasHoja[0]}`, m.representanteControl), [403]);
    });
  });
}
