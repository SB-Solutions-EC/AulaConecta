import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { nominaValida } from './archivos-invalidos';
import { ModuloImportacionReferencia } from './referencia/modulo-importacion-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { tokenValido } from './tokens';
import { verificarCargaNomina } from './verificar-carga';

// Los controles de carga contra la implementación de referencia, sobre NucleoModule (la guardia JWT real, sin los endpoints reales).
describe('Controles de carga de la nómina (RF-04): implementación de referencia', () => {
  let real: AplicacionReal;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloImportacionReferencia]);
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('una nómina válida llega al importador con sus filas contadas', async () => {
    const archivo = nominaValida(25);
    const respuesta = await request(servidor())
      .post('/matriculas/importar')
      .set('Authorization', `Bearer ${tokenValido(['SECRETARIA'])}`)
      .field('cursoId', randomUUID())
      .attach('archivo', archivo.contenido, { filename: 'Nómina 8vo A.xlsx', contentType: archivo.tipo });

    expect(respuesta.status, respuesta.text).toBe(200);
    expect(respuesta.body).toEqual({ totalFilas: 25, importados: 0, errores: [] });
  });

  verificarCargaNomina(servidor, () => randomUUID());
});
