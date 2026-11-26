import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import request, { Response } from 'supertest';
import { Cuerpo } from './endpoints-academicos';
import { tokensRechazados, tokenValido } from './tokens';
import { casosParaServidor, CasoServidor, MundoCalificaciones } from './verificar-calificaciones';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Suite de parámetros (RNF-10, T1125-A): el Administrador cambia una ponderación sin tocar código y las notas
// del trimestre abierto se recalculan. El escenario de medición de la ficha de RNF-10 es «cambiar 70/15/15 por
// 60/20/20 en un ambiente de prueba».
//  1. Con 70/15/15 las notas de la hoja oficial anonimizada coinciden (punto de partida).
//  2. Tras cada cambio de ponderación (60/20/20, 50/25/25, 80/10/10, 100/0/0 y 33,33/33,33/33,34), las notas que ya
//     estaban guardadas se recalculan y coinciden con el oráculo de fracciones exactas
//     (packages/calculo-notas/casos/ponderaciones-hoja-oficial.json): las de la hoja, la del estudiante que
//     las consulta y la de otro curso con otro docente. Volver a 70/15/15 las devuelve a como estaban.
//  3. Una nota que se guarda después del cambio usa las ponderaciones nuevas (que el cliente no mande la nota final ya lo prueba la suite de calificaciones).
//  4. Solo el administrador cambia las ponderaciones (403 para el docente que califica, la secretaría, el estudiante,
//     el representante y una cuenta con la clave temporal pendiente; 401 con los 13 tokens inválidos).
//  5. Una ponderación inválida o una versión vieja se rechaza (400 y 409) y no cambia ni la ponderación ni las notas.
//
// Escenario: el de la suite de calificaciones (curso A con M1 y el docente D1, curso B con otro docente), con las
// notas de la hoja repartidas en 3 trimestres. Se aplica igual a la implementación de referencia y a los endpoints reales.
// Pendiente de la ficha: «en ≤ 10 min» se mide con una persona, no con esta suite; el trimestre cerrado (RN-18) no
// se prueba porque el contrato no tiene cómo cerrarlo.

const PONDERACIONES = resolve(__dirname, '../../../../packages/calculo-notas/casos/ponderaciones-hoja-oficial.json');
const CLAVE = 'ponderaciones_calificaciones';

interface Ponderaciones {
  aportes: number;
  proyecto: number;
  examen: number;
}

interface NotaEsperada {
  notaFinal: number;
  cualitativo: string;
}

export interface EscenarioPonderaciones {
  nombre: string;
  ponderaciones: Ponderaciones;
  filas: Record<string, NotaEsperada>;
}

const OFICIALES: Ponderaciones = { aportes: 70, proyecto: 15, examen: 15 };

/** Escenarios del oráculo para las filas de la hoja que se pueden registrar por la API. */
export function escenariosParaServidor(): { casos: CasoServidor[]; oficial: EscenarioPonderaciones; otros: EscenarioPonderaciones[] } {
  const casos = casosParaServidor();
  const archivo = JSON.parse(readFileSync(PONDERACIONES, 'utf8')) as { escenarios: EscenarioPonderaciones[] };
  const oficial: EscenarioPonderaciones = {
    nombre: '70 / 15 / 15: las oficiales',
    ponderaciones: OFICIALES,
    filas: Object.fromEntries(casos.map((c) => [c.id, { notaFinal: c.notaFinal, cualitativo: c.cualitativo }])),
  };
  // Solo la nota final y el cualitativo: son lo que devuelve la API (el oráculo trae además los componentes)
  const otros = archivo.escenarios.map((e) => ({
    ...e,
    filas: Object.fromEntries(casos.map((c) => [c.id, { notaFinal: e.filas[c.id].notaFinal, cualitativo: e.filas[c.id].cualitativo }])),
  }));
  return { casos, oficial, otros };
}

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;

function enviar(servidor: Server, metodo: 'get' | 'put', ruta: string, token: string | undefined, cuerpo?: object): Promise<Response> {
  let peticion = request(servidor)[metodo](ruta);
  if (token !== undefined) {
    peticion = peticion.set('Authorization', token);
  }
  return Promise.resolve(cuerpo === undefined ? peticion : peticion.send(cuerpo));
}

export function verificarParametros(obtener: ObtenerServidor, mundo: () => MundoCalificaciones, datos: ReturnType<typeof escenariosParaServidor>): void {
  const { casos, oficial, otros } = datos;
  const total = (): number => mundo().matriculasHoja.length;
  /** Cada fila de la hoja ocupa una matrícula y un trimestre propios del curso A. */
  const ranura = (indice: number): { matricula: string; trimestre: number } => ({
    matricula: mundo().matriculasHoja[indice % total()],
    trimestre: Math.floor(indice / total()) + 1,
  });

  const parametros = (token = ADMIN): Promise<Response> => enviar(obtener(), 'get', '/parametros', token);
  /** PUT /parametros con el token indicado (undefined: sin cabecera de autorización). */
  const cambiarComo = (token: string | undefined, valor: unknown, version: unknown, clave: unknown = CLAVE): Promise<Response> =>
    enviar(obtener(), 'put', '/parametros', token, { clave, valor, version });
  const cambiar = (valor: unknown, version: unknown, clave: unknown = CLAVE): Promise<Response> => cambiarComo(ADMIN, valor, version, clave);
  const guardar = (actor: { token: string }, cuerpo: object): Promise<Response> => enviar(obtener(), 'put', '/calificaciones', actor.token, cuerpo);
  const listar = (consulta: string, actor: { token: string }): Promise<Response> => enviar(obtener(), 'get', `/calificaciones${consulta}`, actor.token);

  /** Parámetro de ponderaciones tal como está ahora. */
  const vigente = async (): Promise<Cuerpo> => {
    const respuesta = await parametros();
    expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
    const parametro = (respuesta.body as Cuerpo[]).find((p) => p.clave === CLAVE);
    expect(parametro, `GET /parametros no trae «${CLAVE}»`).toBeDefined();
    return parametro as Cuerpo;
  };
  /** Cambia las ponderaciones con la versión vigente y exige 200. */
  const aplicar = async (ponderaciones: Ponderaciones): Promise<Cuerpo> => {
    const antes = await vigente();
    const respuesta = await cambiar({ ...ponderaciones, minimoAprobacion: 7 }, antes.version);
    expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
    return respuesta.body as Cuerpo;
  };
  const porIndice = async (): Promise<Map<string, Cuerpo>> => {
    const respuesta = await listar(`?asignacionId=${mundo().asignacionA1}`, mundo().docenteMateria);
    expect(respuesta.status).toBe(200);
    return new Map((respuesta.body as Cuerpo[]).map((c) => [`${String(c.matriculaId)}:${String(c.trimestre)}`, c]));
  };
  /** Diferencias entre las notas guardadas de la hoja y las esperadas del escenario (lista vacía si coinciden). */
  const diferencias = async (escenario: EscenarioPonderaciones): Promise<string[]> => {
    const guardadas = await porIndice();
    return casos.flatMap((caso, indice) => {
      const { matricula, trimestre } = ranura(indice);
      const guardada = guardadas.get(`${matricula}:${trimestre}`);
      const esperado = escenario.filas[caso.id];
      return guardada?.notaFinal === esperado.notaFinal && guardada?.cualitativo === esperado.cualitativo
        ? []
        : [`${caso.id}: esperaba ${esperado.notaFinal} ${esperado.cualitativo} y quedó ${String(guardada?.notaFinal)} ${String(guardada?.cualitativo)}`];
    });
  };

  describe('Parámetros: al cambiar una ponderación se recalculan las notas (RNF-10)', () => {
    beforeAll(async () => {
      const m = mundo();
      // Las notas de la hoja, registradas por el docente D1 con las ponderaciones oficiales
      for (const [indice, caso] of casos.entries()) {
        const { matricula, trimestre } = ranura(indice);
        const respuesta = await guardar(m.docenteMateria, { asignacionId: m.asignacionA1, matriculaId: matricula, trimestre, ...caso.aportes, version: 0 });
        if (![200, 201].includes(respuesta.status)) {
          throw new Error(`No se pudo preparar ${caso.id}: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
        }
      }
      // Una nota del estudiante de control (curso A) y otra en el curso B con otro docente
      for (const [docente, asignacionId, matriculaId, caso] of [
        [m.docenteMateria, m.asignacionA1, m.matriculaControl, casos[0]],
        [m.docenteOtroCurso, m.asignacionB1, m.matriculaOtroCurso, casos[1]],
      ] as const) {
        const respuesta = await guardar(docente, { asignacionId, matriculaId, trimestre: 1, ...caso.aportes, version: 0 });
        if (![200, 201].includes(respuesta.status)) {
          throw new Error(`No se pudo preparar la nota de control: HTTP ${respuesta.status} ${respuesta.text.slice(0, 300)}`);
        }
      }
    });

    // Los parámetros son globales: se dejan como estaban para las demás suites
    afterAll(async () => {
      const actual = await vigente();
      await cambiar({ ...OFICIALES, minimoAprobacion: 7 }, actual.version);
    });

    describe('punto de partida: 70 / 15 / 15', () => {
      it('el administrador consulta las ponderaciones vigentes', async () => {
        const parametro = await vigente();

        expect(parametro).toMatchObject({ clave: CLAVE, valor: OFICIALES });
        expect(Number.isInteger(parametro.version)).toBe(true);
      });

      it('las notas de la hoja oficial coinciden con las ponderaciones oficiales', async () => {
        expect(await diferencias(oficial)).toEqual([]);
      });
    });

    describe('el administrador cambia la ponderación y las notas guardadas se recalculan', () => {
      for (const escenario of otros) {
        describe(escenario.nombre, () => {
          let cambio: Cuerpo;
          let versionAntes: number;

          it('el cambio se acepta (200), sube la versión y devuelve las ponderaciones nuevas', async () => {
            versionAntes = Number((await vigente()).version);
            cambio = await aplicar(escenario.ponderaciones);

            expect(cambio).toMatchObject({ clave: CLAVE, valor: escenario.ponderaciones, version: versionAntes + 1 });
          });

          it(`las ${casos.length} notas de la hoja se recalculan y coinciden con el oráculo`, async () => {
            expect(await diferencias(escenario)).toEqual([]);
          });

          it('el estudiante ve su nota recalculada', async () => {
            const m = mundo();
            const respuesta = await listar(`?matriculaId=${m.matriculaControl}`, m.estudianteControl);

            expect(respuesta.status).toBe(200);
            expect(respuesta.body).toEqual([expect.objectContaining(escenario.filas[casos[0].id])]);
          });

          it('también se recalcula la nota de otro curso, de otro docente', async () => {
            const m = mundo();
            const respuesta = await listar(`?asignacionId=${m.asignacionB1}`, m.docenteOtroCurso);

            expect(respuesta.status).toBe(200);
            expect(respuesta.body).toEqual([expect.objectContaining(escenario.filas[casos[1].id])]);
          });
        });
      }

      it('volver a 70 / 15 / 15 devuelve las notas de antes', async () => {
        await aplicar(OFICIALES);

        expect(await diferencias(oficial)).toEqual([]);
      });
    });

    describe('una nota guardada después del cambio usa las ponderaciones nuevas', () => {
      it('con 60 / 20 / 20, el servidor calcula la nota con ellas', async () => {
        const m = mundo();
        const escenario = otros[0];
        await aplicar(escenario.ponderaciones);

        const respuesta = await guardar(m.docenteMateria, {
          asignacionId: m.asignacionA1,
          matriculaId: m.matriculaControl,
          trimestre: 2,
          ...casos[2].aportes,
          version: 0,
        });

        expect([200, 201], respuesta.text.slice(0, 300)).toContain(respuesta.status);
        expect(respuesta.body).toMatchObject(escenario.filas[casos[2].id]);
        await aplicar(OFICIALES);
      });
    });

    describe('solo el administrador cambia las ponderaciones', () => {
      /** Las ponderaciones y las notas siguen como antes del intento. */
      const sinCambios = async (antes: Cuerpo): Promise<void> => {
        expect(await vigente()).toEqual(antes);
        expect(await diferencias(oficial)).toEqual([]);
      };
      const propuesta = { ...otros[0].ponderaciones, minimoAprobacion: 7 };

      const ajenos: [string, (m: MundoCalificaciones) => string][] = [
        ['el docente que califica la materia', (m) => m.docenteMateria.token],
        ['otro docente', (m) => m.docenteOtroCurso.token],
        ['la secretaría', () => SECRETARIA],
        ['el estudiante', (m) => m.estudianteControl.token],
        ['el representante', (m) => m.representanteControl.token],
        ['un docente sin persona registrada', () => `Bearer ${tokenValido(['DOCENTE'], { sub: randomUUID() })}`],
        ['el administrador si aún no cambia su clave temporal', () => `Bearer ${tokenValido(['ADMIN'], { debe_cambiar_clave: true })}`],
      ];
      for (const [nombre, token] of ajenos) {
        it(`403 si lo intenta ${nombre}`, async () => {
          const antes = await vigente();

          esperarRechazo(await cambiarComo(token(mundo()), propuesta, antes.version), [403]);

          await sinCambios(antes);
        });
      }

      for (const token of tokensRechazados()) {
        it(`401 con token ${token.nombre}`, async () => {
          const antes = await vigente();

          esperarRechazo(await cambiarComo(token.cabecera, propuesta, antes.version), [401]);

          await sinCambios(antes);
        });
      }
    });

    describe('una ponderación inválida o una versión vieja se rechaza sin cambiar nada', () => {
      const sinCambios = async (antes: Cuerpo): Promise<void> => {
        expect(await vigente()).toEqual(antes);
        expect(await diferencias(oficial)).toEqual([]);
      };

      const invalidas: [string, Cuerpo][] = [
        ['no suman 100 % (les falta 0,01)', { aportes: 60, proyecto: 20, examen: 19.99 }],
        ['suman más de 100 %', { aportes: 70, proyecto: 15, examen: 15.01 }],
        ['suman 90 %: solo se cambió una', { aportes: 60, proyecto: 15, examen: 15 }],
        ['una es negativa aunque la suma dé 100 %', { aportes: 110, proyecto: -5, examen: -5 }],
        ['una pasa de 100 %', { aportes: 101, proyecto: 0, examen: -1 }],
        ['una llega como texto', { aportes: '60', proyecto: 20, examen: 20 }],
        ['una es null', { aportes: 60, proyecto: null, examen: 40 }],
        ['falta el examen', { aportes: 60, proyecto: 40 }],
        ['con más de 2 decimales', { aportes: 60.001, proyecto: 19.999, examen: 20 }],
        ['la nota mínima de aprobación es 0', { ...otros[0].ponderaciones, minimoAprobacion: 0 }],
        ['la nota mínima de aprobación es 11', { ...otros[0].ponderaciones, minimoAprobacion: 11 }],
        ['la nota mínima de aprobación es texto', { ...otros[0].ponderaciones, minimoAprobacion: 'siete' }],
      ];
      for (const [nombre, valor] of invalidas) {
        it(`400 si ${nombre}`, async () => {
          const antes = await vigente();

          esperarRechazo(await cambiar(valor, antes.version), [400], valor);

          await sinCambios(antes);
        });
      }

      const malFormadas: [string, () => Promise<Response>][] = [
        ['el valor es un texto', async () => cambiar('60/20/20', (await vigente()).version)],
        ['el valor es una lista', async () => cambiar([60, 20, 20], (await vigente()).version)],
        ['el valor es null', async () => cambiar(null, (await vigente()).version)],
        ['la versión llega como texto', async () => cambiar({ ...otros[0].ponderaciones }, '1')],
        ['la versión es negativa', async () => cambiar({ ...otros[0].ponderaciones }, -1)],
        ['falta la versión', async () => cambiar({ ...otros[0].ponderaciones }, undefined)],
        ['la clave está vacía', async () => cambiar({ ...otros[0].ponderaciones }, (await vigente()).version, '')],
      ];
      for (const [nombre, intentar] of malFormadas) {
        it(`400 si ${nombre}`, async () => {
          const antes = await vigente();

          esperarRechazo(await intentar(), [400]);

          await sinCambios(antes);
        });
      }

      it('el parámetro que no existe se rechaza', async () => {
        const antes = await vigente();

        esperarRechazo(await cambiar({ ...otros[0].ponderaciones }, 1, `inexistente_${randomUUID()}`), [400, 404]);

        await sinCambios(antes);
      });

      it('409 con una versión vieja: otro administrador ya cambió la ponderación', async () => {
        const antes = await vigente();
        await aplicar(otros[1].ponderaciones);

        esperarRechazo(await cambiar({ ...otros[0].ponderaciones, minimoAprobacion: 7 }, antes.version), [409]);

        expect((await vigente()).valor).toMatchObject(otros[1].ponderaciones);
        expect(await diferencias(otros[1])).toEqual([]);
        await aplicar(OFICIALES);
      });

      it('acepta decimales cuya suma en coma flotante no da 100 exacto (18,08 + 0,07 + 81,85)', async () => {
        const respuesta = await cambiar({ aportes: 18.08, proyecto: 0.07, examen: 81.85, minimoAprobacion: 7 }, (await vigente()).version);

        expect(respuesta.status, respuesta.text.slice(0, 300)).toBe(200);
        await aplicar(OFICIALES);
        expect(await diferencias(oficial)).toEqual([]);
      });
    });
  });
}
