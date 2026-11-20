import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { cedulaFicticia, palabraFicticia } from './datos-ficticios';
import { ANIOS_LECTIVOS, Cuerpo, MATERIAS } from './endpoints-academicos';
import { INVALIDOS_POR_TIPO } from './entradas-maliciosas';
import { tokensRechazados, tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';
import { CARGAS_XSS } from './verificar-tareas';

// Suite de asistencia y justificación (RF-21, CU-14, CU-19, T1123-A). Regla acordada con el equipo:
// el DOCENTE de esa materia en ese curso registra la asistencia y es el ÚNICO que aprueba una
// justificación; el ESTUDIANTE dueño de la falta solo la solicita; nadie más la cambia.
//
// Escenario armado por la API:
//   curso A (año 1): M1 con el docente D1 (asignación A1), M2 con D2; estudiantes E1 (con su representante R1) y E2
//   curso B (año 2): M1 con D3; estudiante F
// Se aplica igual a la implementación de referencia y a los endpoints reales.

export interface ActorAsistencia {
  personaId: string;
  usuarioId: string;
  token: string;
}

export interface MundoAsistencia {
  asignacionA1: string;
  asignacionA2: string;
  /** Inicio y fin del año lectivo del curso A. */
  anioA: { inicio: string; fin: string };
  d1: ActorAsistencia;
  d2: ActorAsistencia;
  d3: ActorAsistencia;
  e1: ActorAsistencia;
  r1: ActorAsistencia;
  e2: ActorAsistencia;
  f: ActorAsistencia;
  matricula: { e1: string; e2: string; f: string };
}

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

function enviar(servidor: Server, metodo: 'get' | 'post' | 'put', ruta: string, token: string | undefined, cuerpo?: object) {
  let peticion = request(servidor)[metodo](ruta);
  if (token !== undefined) {
    peticion = peticion.set('Authorization', token);
  }
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

export async function construirMundoAsistencia(servidor: Server): Promise<MundoAsistencia> {
  const post = async (ruta: string, cuerpo: Cuerpo, token = ADMIN): Promise<Cuerpo> => {
    const respuesta = await enviar(servidor, 'post', ruta, token, cuerpo);
    if (respuesta.status !== 201) {
      throw new Error(`No se pudo preparar ${ruta}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
    }
    return respuesta.body as Cuerpo;
  };
  const persona = async (tipo: 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE'): Promise<ActorAsistencia> => {
    const creada = await post('/personas', { id: randomUUID(), tipo, nombres: palabraFicticia(), apellidos: palabraFicticia(), cedula: cedulaFicticia() });
    const usuarioId = String(creada.usuarioId);
    return { personaId: String(creada.id), usuarioId, token: `Bearer ${tokenValido([tipo], { sub: usuarioId })}` };
  };
  const curso = async (): Promise<{ id: string; inicio: string; fin: string }> => {
    const anio = await post('/anios-lectivos', await ANIOS_LECTIVOS.cuerpoValido(post));
    const creado = await post('/cursos', { id: randomUUID(), anioLectivoId: anio.id, nivel: `Nivel ${palabraFicticia()} EGB`, paralelo: 'A' });
    return { id: String(creado.id), inicio: String(anio.inicio), fin: String(anio.fin) };
  };

  const a = await curso();
  const b = await curso();
  const materia1 = String((await post('/materias', await MATERIAS.cuerpoValido(post))).id);
  const materia2 = String((await post('/materias', await MATERIAS.cuerpoValido(post))).id);
  const [d1, d2, d3] = [await persona('DOCENTE'), await persona('DOCENTE'), await persona('DOCENTE')];
  const asignar = async (docente: ActorAsistencia, materia: string, cursoId: string): Promise<string> =>
    String((await post('/asignaciones', { docenteId: docente.personaId, materiaId: materia, cursoId })).id);
  const asignacionA1 = await asignar(d1, materia1, a.id);
  const asignacionA2 = await asignar(d2, materia2, a.id);
  await asignar(d3, materia1, b.id);

  const [e1, e2, f] = [await persona('ESTUDIANTE'), await persona('ESTUDIANTE'), await persona('ESTUDIANTE')];
  const r1 = await persona('REPRESENTANTE');
  await post('/representaciones', { estudianteId: e1.personaId, representanteId: r1.personaId, parentesco: 'Padre' });
  const matricular = async (estudiante: ActorAsistencia, cursoId: string): Promise<string> =>
    String((await post('/matriculas', { estudianteId: estudiante.personaId, cursoId }, SECRETARIA)).id);
  const matricula = { e1: await matricular(e1, a.id), e2: await matricular(e2, a.id), f: await matricular(f, b.id) };

  return { asignacionA1, asignacionA2, anioA: { inicio: a.inicio, fin: a.fin }, d1, d2, d3, e1, r1, e2, f, matricula };
}

export function verificarAsistencia(obtener: ObtenerServidor, mundo: () => MundoAsistencia): void {
  const como = (actor: ActorAsistencia | string | undefined): string | undefined => (typeof actor === 'object' ? actor.token : actor);
  const registrar = (actor: ActorAsistencia | string | undefined, cuerpo: object): Promise<Response> => enviar(obtener(), 'put', '/asistencias', como(actor), cuerpo);
  const solicitar = (actor: ActorAsistencia | string | undefined, asistenciaId: string, motivo: unknown): Promise<Response> =>
    enviar(obtener(), 'post', `/asistencias/${asistenciaId}/justificacion`, como(actor), { motivo });
  const consultar = (actor: ActorAsistencia | string, consulta: string): Promise<Response> => enviar(obtener(), 'get', `/asistencias${consulta}`, como(actor));

  // Cada prueba usa su propio día de clase dentro del año lectivo del curso A (septiembre a junio)
  let dia = 0;
  const diaDeClase = (m: MundoAsistencia): string => {
    dia += 1;
    const fecha = new Date(`${m.anioA.inicio}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dia);
    return fecha.toISOString().slice(0, 10);
  };
  const asistencia = (m: MundoAsistencia, cambios: object = {}): Cuerpo => ({
    asignacionId: m.asignacionA1,
    matriculaId: m.matricula.e1,
    fecha: diaDeClase(m),
    estado: 'FALTA',
    version: 0,
    ...cambios,
  });
  /** Falta de E1 registrada por D1; devuelve la asistencia creada. */
  const faltaDeE1 = async (m: MundoAsistencia, cambios: object = {}): Promise<Cuerpo> => {
    const respuesta = await registrar(m.d1, asistencia(m, cambios));
    expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
    return respuesta.body as Cuerpo;
  };

  describe('Registrar asistencia: solo el docente de la asignación (RF-21)', () => {
    it('el docente de M1 registra la falta de su estudiante (control)', async () => {
      const m = mundo();
      const cuerpo = asistencia(m);
      const respuesta = await registrar(m.d1, cuerpo);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toMatchObject({ asignacionId: m.asignacionA1, matriculaId: m.matricula.e1, fecha: cuerpo.fecha, estado: 'FALTA' });
    });

    const ajenos: [string, (m: MundoAsistencia) => ActorAsistencia | string][] = [
      ['el docente de otra materia del mismo curso', (m) => m.d2],
      ['el docente de la misma materia en otro curso', (m) => m.d3],
      ['el administrador', () => ADMIN],
      ['la secretaría', () => SECRETARIA],
      ['el propio estudiante', (m) => m.e1],
      ['su representante', (m) => m.r1],
      ['un docente sin persona registrada', () => `Bearer ${tokenValido(['DOCENTE'], { sub: randomUUID() })}`],
      ['el docente de M1 si aún no cambia su clave temporal', (m) => `Bearer ${tokenValido(['DOCENTE'], { sub: m.d1.usuarioId, debe_cambiar_clave: true })}`],
    ];
    for (const [nombre, actor] of ajenos) {
      it(`403 · registra la asistencia ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await registrar(actor(m), asistencia(m, { estado: 'PRESENTE' })), [403]);
      });
    }

    for (const token of tokensRechazados()) {
      it(`401 con token ${token.nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await registrar(token.cabecera, asistencia(m)), [401]);
      });
    }

    it('403 · idéntico para una asignación ajena y una inventada', async () => {
      const m = mundo();
      const ajena = await registrar(m.d1, asistencia(m, { asignacionId: m.asignacionA2 }));
      const inventada = await registrar(m.d1, asistencia(m, { asignacionId: randomUUID() }));

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });

    it('se rechaza la asistencia de un estudiante de otro curso', async () => {
      const m = mundo();
      esperarRechazo(await registrar(m.d1, asistencia(m, { matriculaId: m.matricula.f })), [400, 403, 404, 422]);
    });

    const fechas: [string, (m: MundoAsistencia) => string][] = [
      ['antes del inicio del año lectivo (falla de RF-21)', (m) => `${m.anioA.inicio.slice(0, 4)}-08-15`],
      ['después del fin del año lectivo (falla de RF-21)', (m) => `${m.anioA.fin.slice(0, 4)}-08-15`],
    ];
    for (const [nombre, fecha] of fechas) {
      it(`400 con una fecha ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await registrar(m.d1, asistencia(m, { fecha: fecha(m) })), [400]);
      });
    }

    const invalidos: [string, object][] = [
      ['un estado que no existe', { estado: 'AUSENTE' }],
      ['el estado en minúsculas', { estado: 'falta' }],
      ['fecha con hora', { fecha: '2026-10-06T08:00:00Z' }],
      ['sin versión', { version: undefined }],
      ['matrícula que no es UUID', { matriculaId: "' OR '1'='1" }],
      ['campos que el contrato no define (registradoPorId)', { registradoPorId: randomUUID() }],
      ['justificación de más de 255 caracteres', { estado: 'JUSTIFICADA', justificacion: 'a'.repeat(256) }],
    ];
    for (const [nombre, cambios] of invalidos) {
      it(`400 con ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await registrar(m.d1, asistencia(m, cambios)), [400]);
      });
    }

    it('409 si se guarda sobre una versión vieja', async () => {
      const m = mundo();
      const creada = await faltaDeE1(m);
      const cambio = { fecha: creada.fecha, estado: 'ATRASO' };

      expect((await registrar(m.d1, asistencia(m, { ...cambio, version: creada.version }))).status).toBe(200);
      esperarRechazo(await registrar(m.d1, asistencia(m, { ...cambio, version: creada.version })), [409]);
    });
  });

  describe('Quién puede justificar: el estudiante solicita, solo el docente aprueba (CU-19)', () => {
    it('el estudiante solicita la justificación de su falta: queda SOLICITADA y sigue siendo FALTA', async () => {
      const m = mundo();
      const falta = await faltaDeE1(m);
      const respuesta = await solicitar(m.e1, String(falta.id), 'Cita médica, adjunto certificado.');

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toMatchObject({ estado: 'FALTA', estadoJustificacion: 'SOLICITADA', justificacion: 'Cita médica, adjunto certificado.' });
    });

    it('el docente aprueba la solicitud: queda JUSTIFICADA con el motivo del estudiante', async () => {
      const m = mundo();
      const falta = await faltaDeE1(m);
      const solicitada = await solicitar(m.e1, String(falta.id), 'Calamidad doméstica');
      expect(solicitada.status, solicitada.text.slice(0, 300)).toBe(200);

      const aprobada = await registrar(m.d1, asistencia(m, { fecha: falta.fecha, estado: 'JUSTIFICADA', version: solicitada.body.version }));
      expect(aprobada.status, aprobada.text.slice(0, 300)).toBe(200);
      expect(aprobada.body).toMatchObject({ estado: 'JUSTIFICADA', estadoJustificacion: 'APROBADA', justificacion: 'Calamidad doméstica' });
    });

    const noSolicitan: [string, (m: MundoAsistencia) => ActorAsistencia | string][] = [
      ['un compañero del mismo curso', (m) => m.e2],
      ['un estudiante de otro curso', (m) => m.f],
      ['el representante (según la matriz de permisos solo consulta)', (m) => m.r1],
      ['el docente (él aprueba, no solicita)', (m) => m.d1],
      ['el docente de otra materia', (m) => m.d2],
      ['la secretaría', () => SECRETARIA],
      ['el administrador', () => ADMIN],
    ];
    for (const [nombre, actor] of noSolicitan) {
      it(`403 · solicita la justificación de la falta de E1 ${nombre}`, async () => {
        const m = mundo();
        const falta = await faltaDeE1(m);
        esperarRechazo(await solicitar(actor(m), String(falta.id), 'Motivo inventado'), [403]);
      });
    }

    const noAprueban: [string, (m: MundoAsistencia) => ActorAsistencia | string][] = [
      ['el propio estudiante', (m) => m.e1],
      ['su representante', (m) => m.r1],
      ['el docente de otra materia del mismo curso', (m) => m.d2],
      ['el docente de la misma materia en otro curso', (m) => m.d3],
      ['la secretaría', () => SECRETARIA],
      ['el administrador', () => ADMIN],
    ];
    for (const [nombre, actor] of noAprueban) {
      it(`403 · aprueba (marca JUSTIFICADA) ${nombre}`, async () => {
        const m = mundo();
        const falta = await faltaDeE1(m);
        const solicitada = await solicitar(m.e1, String(falta.id), 'Cita médica');
        const respuesta = await registrar(actor(m), asistencia(m, { fecha: falta.fecha, estado: 'JUSTIFICADA', justificacion: 'Aprobada por mí', version: solicitada.body.version }));

        esperarRechazo(respuesta, [403]);
        const vigente = await consultar(m.d1, `?asignacionId=${m.asignacionA1}&matriculaId=${m.matricula.e1}&fecha=${String(falta.fecha)}`);
        expect((vigente.body as Cuerpo[])[0]).toMatchObject({ estado: 'FALTA', estadoJustificacion: 'SOLICITADA' });
      });
    }

    it('el estudiante no se aprueba a sí mismo mandando estado JUSTIFICADA en su solicitud', async () => {
      const m = mundo();
      const falta = await faltaDeE1(m);
      const respuesta = await enviar(obtener(), 'post', `/asistencias/${String(falta.id)}/justificacion`, m.e1.token, { motivo: 'Cita', estado: 'JUSTIFICADA', estadoJustificacion: 'APROBADA' });

      if (respuesta.status !== 200) {
        esperarRechazo(respuesta, [400]);
        return;
      }
      expect(respuesta.body).toMatchObject({ estado: 'FALTA', estadoJustificacion: 'SOLICITADA' });
    });

    it('403 · idéntico para la asistencia de un compañero y una inventada', async () => {
      const m = mundo();
      const falta = await faltaDeE1(m);
      const ajena = await solicitar(m.e2, String(falta.id), 'Motivo');
      const inventada = await solicitar(m.e2, randomUUID(), 'Motivo');

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });

    it('409 si no hay nada que justificar (estuvo PRESENTE)', async () => {
      const m = mundo();
      const presente = await faltaDeE1(m, { estado: 'PRESENTE' });
      esperarRechazo(await solicitar(m.e1, String(presente.id), 'Motivo'), [400, 409]);
    });

    it('409 si ya hay una solicitud pendiente', async () => {
      const m = mundo();
      const falta = await faltaDeE1(m);
      expect((await solicitar(m.e1, String(falta.id), 'Primer motivo')).status).toBe(200);
      esperarRechazo(await solicitar(m.e1, String(falta.id), 'Segundo motivo'), [409]);
    });

    it('el atraso también se puede justificar', async () => {
      const m = mundo();
      const atraso = await faltaDeE1(m, { estado: 'ATRASO' });
      expect((await solicitar(m.e1, String(atraso.id), 'Transporte')).status).toBe(200);
    });

    it('400 si el docente marca JUSTIFICADA sin motivo y sin solicitud del estudiante', async () => {
      const m = mundo();
      esperarRechazo(await registrar(m.d1, asistencia(m, { estado: 'JUSTIFICADA' })), [400]);
    });

    it('el docente puede justificar con su propio motivo aunque el estudiante no lo haya pedido', async () => {
      const m = mundo();
      const respuesta = await registrar(m.d1, asistencia(m, { estado: 'JUSTIFICADA', justificacion: 'Representó al colegio en el intercolegial' }));
      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(respuesta.body).toMatchObject({ estado: 'JUSTIFICADA', estadoJustificacion: 'APROBADA' });
    });

    it('409 si una falta ya justificada se marca de nuevo como falta sin confirmar (excepción de RF-21); con confirmar se guarda', async () => {
      const m = mundo();
      const justificada = await faltaDeE1(m, { estado: 'JUSTIFICADA', justificacion: 'Cita médica' });
      const cambio = { fecha: justificada.fecha, estado: 'FALTA', version: justificada.version };

      esperarRechazo(await registrar(m.d1, asistencia(m, cambio)), [409]);
      const confirmada = await registrar(m.d1, asistencia(m, { ...cambio, confirmar: true }));
      expect(confirmada.status, confirmada.text.slice(0, 300)).toBe(200);
      expect(confirmada.body.estado).toBe('FALTA');
    });

    // El motivo es multilínea (como la descripción de una tarea): un salto de línea es válido
    for (const entrada of INVALIDOS_POR_TIPO.texto.filter((e) => (typeof e.valor === 'string' || e.valor === null) && !e.nombre.startsWith('salto de línea'))) {
      it(`400 con un motivo ${entrada.nombre}`, async () => {
        const m = mundo();
        const falta = await faltaDeE1(m);
        esperarRechazo(await solicitar(m.e1, String(falta.id), entrada.valor), [400], entrada.valor);
      });
    }

    for (const entrada of CARGAS_XSS.slice(0, 8)) {
      it(`motivo con ${entrada.nombre}: se rechaza o se guarda literal`, async () => {
        const m = mundo();
        const falta = await faltaDeE1(m);
        const respuesta = await solicitar(m.e1, String(falta.id), entrada.valor);
        if (respuesta.status !== 200) {
          esperarRechazo(respuesta, [400], entrada.valor);
          return;
        }
        expect(respuesta.headers['content-type']).toMatch(/^application\/json/);
        expect(respuesta.body.justificacion).toBe(entrada.valor);
      });
    }
  });

  describe('Consultar asistencia: cada quien ve solo lo suyo (RNF-04)', () => {
    it('el docente de A1 ve la asistencia de sus estudiantes', async () => {
      const m = mundo();
      await faltaDeE1(m, { matriculaId: m.matricula.e2 });
      const respuesta = await consultar(m.d1, `?asignacionId=${m.asignacionA1}`);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(new Set((respuesta.body as Cuerpo[]).map((a) => a.matriculaId))).toEqual(new Set([m.matricula.e1, m.matricula.e2]));
    });

    it('el estudiante ve solo su asistencia y el motivo de sus justificaciones', async () => {
      const m = mundo();
      const respuesta = await consultar(m.e1, '');

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect(new Set((respuesta.body as Cuerpo[]).map((a) => a.matriculaId))).toEqual(new Set([m.matricula.e1]));
      expect(respuesta.text).not.toContain(m.matricula.e2);
    });

    it('el representante ve la asistencia de su representado', async () => {
      const m = mundo();
      const respuesta = await consultar(m.r1, `?matriculaId=${m.matricula.e1}`);

      expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
      expect((respuesta.body as Cuerpo[]).every((a) => a.matriculaId === m.matricula.e1)).toBe(true);
      expect((respuesta.body as Cuerpo[]).length).toBeGreaterThan(0);
    });

    const ajenos: [string, (m: MundoAsistencia) => ActorAsistencia | string, (m: MundoAsistencia) => string][] = [
      ['E1 pide la asistencia de E2', (m) => m.e1, (m) => `?matriculaId=${m.matricula.e2}`],
      ['E1 pide la libreta de asistencia de A1', (m) => m.e1, (m) => `?asignacionId=${m.asignacionA1}`],
      ['F (otro curso) pide la asistencia de E1', (m) => m.f, (m) => `?matriculaId=${m.matricula.e1}`],
      ['el representante de E1 pide la de E2', (m) => m.r1, (m) => `?matriculaId=${m.matricula.e2}`],
      ['el docente de otra materia pide la libreta de A1', (m) => m.d2, (m) => `?asignacionId=${m.asignacionA1}`],
      ['el docente del curso B pide la libreta de A1', (m) => m.d3, (m) => `?asignacionId=${m.asignacionA1}`],
      ['la secretaría pide la asistencia de E1', () => SECRETARIA, (m) => `?matriculaId=${m.matricula.e1}`],
      ['la secretaría pide la libreta de A1', () => SECRETARIA, (m) => `?asignacionId=${m.asignacionA1}`],
    ];
    for (const [nombre, actor, consulta] of ajenos) {
      it(`403 · ${nombre}`, async () => {
        const m = mundo();
        esperarRechazo(await consultar(actor(m), consulta(m)), [403]);
      });
    }

    it('403 · idéntico para la matrícula de un compañero y una inventada', async () => {
      const m = mundo();
      const ajena = await consultar(m.e1, `?matriculaId=${m.matricula.e2}`);
      const inventada = await consultar(m.e1, `?matriculaId=${randomUUID()}`);

      esperarRechazo(ajena, [403]);
      esperarRechazo(inventada, [403]);
      expect([inventada.body.codigo, inventada.body.mensaje]).toEqual([ajena.body.codigo, ajena.body.mensaje]);
    });
  });
}
