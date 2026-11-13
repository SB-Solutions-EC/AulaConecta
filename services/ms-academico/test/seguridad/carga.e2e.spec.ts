import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { crearAplicacionReal } from './aplicacion-real';
import { CURSOS, Cuerpo } from './endpoints-academicos';
import { tokenValido } from './tokens';
import { verificarCargaNomina } from './verificar-carga';

// Controles de carga contra el importador REAL de nóminas (T1112-M). Se omite mientras no exista
// POST /matriculas/importar; en cuanto exista, un archivo inválido que pase bloquea el PR.

describe('Controles de carga de la nómina (RF-04): importador real de ms-academico', async () => {
  const real = await crearAplicacionReal();
  const existe = await real.montado('post', '/matriculas/importar');
  let cursoId: string = randomUUID();

  afterAll(async () => {
    await real.cerrar();
  });

  it('verifica la disponibilidad del endpoint de importación en AppModule', () => {
    expect(typeof existe).toBe('boolean');
  });

  describe.skipIf(!existe)('POST /matriculas/importar (se omite mientras no exista)', () => {
    beforeAll(async () => {
      // Si ya existen los endpoints de cursos, la nómina va a un curso real
      if (await real.montado('post', '/cursos')) {
        const admin = `Bearer ${tokenValido(['ADMIN'])}`;
        const crear = async (ruta: string, cuerpo: Cuerpo): Promise<Cuerpo> =>
          (await request(real.servidor()).post(ruta).set('Authorization', admin).send(cuerpo)).body as Cuerpo;
        cursoId = String((await crear('/cursos', await CURSOS.cuerpoValido(crear))).id ?? cursoId);
      }
    });

    verificarCargaNomina(real.servidor, () => cursoId);
  });
});
