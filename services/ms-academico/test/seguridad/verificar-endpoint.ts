import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { Cuerpo, EndpointCreacion, EndpointListado, ROLES } from './endpoints-academicos';
import { CONSULTAS_UUID_INVALIDAS, INVALIDOS_POR_TIPO, INYECCIONES_TEXTO, RASTROS_INTERNOS } from './entradas-maliciosas';
import { tokensRechazados, tokenValido } from './tokens';

// Pruebas reutilizables de validación de entradas, inyección y autorización.
// Se aplican igual a la implementación real (AppModule) y a la de referencia de esta carpeta.

export type ObtenerServidor = () => Server;

interface Envio {
  cuerpo?: unknown;
  /** Cuerpo ya serializado (JSON mal formado, __proto__ literal...). */
  crudo?: string;
  tipo?: string;
  autorizacion?: string;
}

const ADMIN = `Bearer ${tokenValido(['ADMIN'])}`;

async function enviar(servidor: Server, metodo: 'get' | 'post', ruta: string, envio: Envio = {}): Promise<Response> {
  let peticion = request(servidor)[metodo](ruta);
  const autorizacion = 'autorizacion' in envio ? envio.autorizacion : ADMIN;
  if (autorizacion !== undefined) {
    peticion = peticion.set('Authorization', autorizacion);
  }
  if (envio.crudo !== undefined) {
    return peticion.set('Content-Type', envio.tipo ?? 'application/json').send(envio.crudo);
  }
  if (envio.cuerpo !== undefined) {
    return peticion.send(envio.cuerpo as object);
  }
  return peticion;
}

/** Comprueba un rechazo: estado esperado, forma ErrorApi y nada interno en la respuesta. */
export function esperarRechazo(respuesta: Response, estados: number[], valorEnviado?: unknown): void {
  expect(estados, `estado ${respuesta.status}: ${respuesta.text.slice(0, 300)}`).toContain(respuesta.status);
  expect(respuesta.headers['content-type']).toMatch(/^application\/json/);
  expect(respuesta.body).toMatchObject({ codigo: expect.stringMatching(/^[A-Z_]+$/), mensaje: expect.any(String) });
  expect(Number.isNaN(Date.parse(respuesta.body.timestamp))).toBe(false);
  for (const rastro of RASTROS_INTERNOS) {
    expect(respuesta.text).not.toMatch(rastro);
  }
  // El valor rechazado no vuelve al cliente (evita reflejar XSS o datos sensibles)
  if (typeof valorEnviado === 'string' && valorEnviado.trim().length >= 4) {
    expect(respuesta.text).not.toContain(JSON.stringify(valorEnviado).slice(1, -1));
  }
}

function sinCampo(cuerpo: Cuerpo, campo: string): Cuerpo {
  const copia = { ...cuerpo };
  delete copia[campo];
  return copia;
}

export function verificarCreacion(obtener: ObtenerServidor, endpoint: EndpointCreacion): void {
  const crear = async (ruta: string, cuerpo: Cuerpo): Promise<Cuerpo> => {
    const respuesta = await enviar(obtener(), 'post', ruta, { cuerpo });
    expect(respuesta.status, `crear ${ruta}: ${respuesta.text.slice(0, 300)}`).toBe(201);
    return respuesta.body as Cuerpo;
  };
  const valido = (): Promise<Cuerpo> => endpoint.cuerpoValido(crear);
  const post = async (envio: Envio): Promise<Response> => enviar(obtener(), 'post', endpoint.ruta, envio);

  describe(`POST ${endpoint.ruta}`, () => {
    it('acepta un cuerpo válido (control: las demás pruebas no pasan por accidente)', async () => {
      const cuerpo = await valido();
      const respuesta = await post({ cuerpo });

      expect(respuesta.status, respuesta.text).toBe(201);
      expect(respuesta.body).toMatchObject(cuerpo);
    });

    describe('autenticación y rol', () => {
      for (const token of tokensRechazados()) {
        it(`401 con token ${token.nombre}`, async () => {
          esperarRechazo(await post({ cuerpo: await valido(), autorizacion: token.cabecera }), [401]);
        });
      }
      for (const rol of ROLES.filter((r) => !endpoint.rolesPermitidos.includes(r))) {
        it(`403 para el rol ${rol}`, async () => {
          esperarRechazo(await post({ cuerpo: await valido(), autorizacion: `Bearer ${tokenValido([rol])}` }), [403]);
        });
      }
      it('403 si el ADMIN aún no cambia su clave inicial', async () => {
        const autorizacion = `Bearer ${tokenValido(['ADMIN'], { debe_cambiar_clave: true })}`;
        esperarRechazo(await post({ cuerpo: await valido(), autorizacion }), [403]);
      });
    });

    describe('campos obligatorios y tipos', () => {
      for (const campo of endpoint.campos.filter((c) => c.requerido)) {
        it(`400 si falta ${campo.nombre}`, async () => {
          esperarRechazo(await post({ cuerpo: sinCampo(await valido(), campo.nombre) }), [400]);
        });
      }
      for (const campo of endpoint.campos) {
        for (const entrada of INVALIDOS_POR_TIPO[campo.tipo]) {
          it(`400 con ${campo.nombre} = ${entrada.nombre}`, async () => {
            const respuesta = await post({ cuerpo: { ...(await valido()), [campo.nombre]: entrada.valor } });
            esperarRechazo(respuesta, [400], entrada.valor);
          });
        }
      }
    });

    describe('inyección en campos de texto', () => {
      for (const campo of endpoint.campos.filter((c) => c.tipo === 'texto')) {
        for (const entrada of INYECCIONES_TEXTO) {
          it(`${campo.nombre} con ${entrada.nombre}: se rechaza o se guarda literal`, async () => {
            const cuerpo = { ...(await valido()), [campo.nombre]: entrada.valor };
            const respuesta = await post({ cuerpo });

            if (respuesta.status !== 201) {
              esperarRechazo(respuesta, [400], entrada.valor);
              return;
            }
            // Aceptado: debe guardarse exactamente lo enviado y la tabla seguir intacta
            expect(respuesta.body[campo.nombre]).toBe(entrada.valor);
            const listado = await enviar(obtener(), 'get', endpoint.rutaListado);
            expect(listado.status).toBe(200);
            const guardado = (listado.body as Cuerpo[]).find((item) => item.id === respuesta.body.id);
            expect(guardado?.[campo.nombre]).toBe(entrada.valor);
          });
        }
      }
    });

    describe('cuerpo de la solicitud', () => {
      it('campos que el contrato no define (version, rol): se rechazan o se ignoran', async () => {
        const respuesta = await post({ cuerpo: { ...(await valido()), version: 999, rol: 'ADMIN', eliminado: true } });

        if (respuesta.status !== 201) {
          esperarRechazo(respuesta, [400]);
          return;
        }
        expect(respuesta.body.version).not.toBe(999);
        expect(respuesta.body).not.toHaveProperty('rol');
        expect(respuesta.body).not.toHaveProperty('eliminado');
      });

      for (const clave of ['__proto__', 'constructor']) {
        it(`${clave} no contamina el prototipo de los objetos`, async () => {
          const extra = clave === '__proto__' ? { contaminado: true } : { prototype: { contaminado: true } };
          const crudo = JSON.stringify(await valido()).replace(/^\{/, `{"${clave}":${JSON.stringify(extra)},`);
          const respuesta = await post({ crudo });

          expect([400, 201]).toContain(respuesta.status);
          if (respuesta.status === 400) {
            esperarRechazo(respuesta, [400]);
          }
          expect(({} as Record<string, unknown>).contaminado).toBeUndefined();
          expect(respuesta.body).not.toHaveProperty('contaminado');
        });
      }

      it('400 con JSON mal formado, sin revelar el error del analizador', async () => {
        esperarRechazo(await post({ crudo: '{"nombre": "Matemática", ' }), [400]);
      });
      it('400 con un arreglo en lugar de un objeto', async () => {
        esperarRechazo(await post({ cuerpo: [await valido()] }), [400]);
      });
      it('400 sin cuerpo', async () => {
        esperarRechazo(await post({}), [400]);
      });
      it('400 o 415 si no se envía como JSON', async () => {
        esperarRechazo(await post({ crudo: 'nombre=Matematica&area=Ciencias', tipo: 'application/x-www-form-urlencoded' }), [400, 415]);
      });
      it('413 o 400 con un cuerpo de 200 KB', async () => {
        const respuesta = await post({ cuerpo: { ...(await valido()), relleno: 'x'.repeat(200 * 1024) } });
        esperarRechazo(respuesta, [400, 413]);
      });
    });

    describe('reglas del negocio', () => {
      for (const regla of endpoint.reglas) {
        it(`se rechaza si ${regla.nombre}`, async () => {
          const cuerpo = await regla.cuerpo(crear, await valido());
          esperarRechazo(await post({ cuerpo }), regla.estados);
        });
      }
    });
  });
}

export function verificarListado(obtener: ObtenerServidor, endpoint: EndpointListado): void {
  // Sin el segundo argumento va como ADMIN; con undefined explícito, sin cabecera
  const get = async (consulta = '', ...autorizacion: [string | undefined] | []): Promise<Response> =>
    enviar(obtener(), 'get', `${endpoint.ruta}${consulta}`, autorizacion.length ? { autorizacion: autorizacion[0] } : {});

  describe(`GET ${endpoint.ruta}`, () => {
    it('responde 200 con una lista (control)', async () => {
      const respuesta = await get();

      expect(respuesta.status, respuesta.text).toBe(200);
      expect(Array.isArray(respuesta.body)).toBe(true);
    });

    for (const token of tokensRechazados()) {
      it(`401 con token ${token.nombre}`, async () => {
        esperarRechazo(await get('', token.cabecera), [401]);
      });
    }
    it('403 si el usuario aún no cambia su clave inicial', async () => {
      esperarRechazo(await get('', `Bearer ${tokenValido(['ADMIN'], { debe_cambiar_clave: true })}`), [403]);
    });

    for (const filtro of endpoint.filtrosUuid) {
      it(`filtra por ${filtro} con un UUID válido`, async () => {
        const respuesta = await get(`?${filtro}=${randomUUID()}`);

        expect(respuesta.status, respuesta.text).toBe(200);
        expect(respuesta.body).toEqual([]);
      });
      for (const valor of CONSULTAS_UUID_INVALIDAS) {
        it(`400 con ?${filtro}=${valor}`, async () => {
          esperarRechazo(await get(`?${filtro}=${encodeURIComponent(valor)}`), [400], valor);
        });
      }
      it(`400 si ${filtro} llega repetido (contaminación de parámetros)`, async () => {
        esperarRechazo(await get(`?${filtro}=${randomUUID()}&${filtro}=${randomUUID()}`), [400]);
      });
    }
  });
}
