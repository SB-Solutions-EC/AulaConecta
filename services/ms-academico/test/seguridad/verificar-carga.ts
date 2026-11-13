import { randomUUID } from 'node:crypto';
import request, { Response } from 'supertest';
import { LIMITES_CARGA } from '../../src/importacion/limites';
import { ArchivoDePrueba, CASOS_ARCHIVO, nominaValida } from './archivos-invalidos';
import { ROLES } from './endpoints-academicos';
import { tokenValido } from './tokens';
import { esperarRechazo, ObtenerServidor } from './verificar-endpoint';

// Controles de carga de la nómina en Excel (RF-04, T1112-A) sobre POST /matriculas/importar.
// Se aplica a la implementación de referencia y al importador real de T1112-M.

const RUTA = '/matriculas/importar';
const PERMITIDOS = ['ADMIN', 'SECRETARIA'];
const SECRETARIA = `Bearer ${tokenValido(['SECRETARIA'])}`;
// Códigos de los controles de carga: si una nómina válida recibe uno de estos, el control está mal
const CODIGOS_DE_CARGA = new Set([...CASOS_ARCHIVO.map((c) => c.codigo), 'ARCHIVO_REQUERIDO']);

export function verificarCargaNomina(obtener: ObtenerServidor, cursoId: () => string): void {
  // token null: sin cabecera Authorization (un undefined tomaría el valor por defecto)
  const subir = (archivo: ArchivoDePrueba | undefined, token: string | null = SECRETARIA, campo = 'archivo'): Promise<Response> => {
    let peticion = request(obtener()).post(RUTA);
    if (token) {
      peticion = peticion.set('Authorization', token);
    }
    peticion = peticion.field('cursoId', cursoId());
    return archivo ? peticion.attach(campo, archivo.contenido, { filename: archivo.nombreArchivo, contentType: archivo.tipo }) : peticion;
  };

  describe(`POST ${RUTA}`, () => {
    describe('nóminas válidas (control: los límites no rechazan lo legítimo)', () => {
      for (const filas of [3, LIMITES_CARGA.filas]) {
        it(`acepta una nómina de ${filas} estudiantes`, async () => {
          const respuesta = await subir(nominaValida(filas));

          expect([413, 415], respuesta.text.slice(0, 300)).not.toContain(respuesta.status);
          expect(CODIGOS_DE_CARGA.has(respuesta.body?.codigo)).toBe(false);
          expect(respuesta.status, respuesta.text.slice(0, 300)).toBeLessThan(500);
        });
      }
    });

    describe('quién puede importar', () => {
      it('401 sin token', async () => {
        esperarRechazo(await subir(nominaValida(), null), [401]);
      });
      for (const rol of ROLES.filter((r) => !PERMITIDOS.includes(r))) {
        it(`403 para el rol ${rol}`, async () => {
          esperarRechazo(await subir(nominaValida(), `Bearer ${tokenValido([rol])}`), [403]);
        });
      }
    });

    describe('forma de la solicitud', () => {
      it('400 ARCHIVO_REQUERIDO si no se adjunta archivo', async () => {
        const respuesta = await subir(undefined);
        esperarRechazo(respuesta, [400]);
        expect(respuesta.body.codigo).toBe('ARCHIVO_REQUERIDO');
      });

      it('400 si el archivo llega en otro campo', async () => {
        esperarRechazo(await subir(nominaValida(), SECRETARIA, 'file'), [400]);
      });

      it('400 si se adjuntan dos archivos', async () => {
        const archivo = nominaValida();
        const respuesta = await request(obtener())
          .post(RUTA)
          .set('Authorization', SECRETARIA)
          .field('cursoId', cursoId())
          .attach('archivo', archivo.contenido, { filename: 'a.xlsx', contentType: archivo.tipo })
          .attach('archivo', archivo.contenido, { filename: 'b.xlsx', contentType: archivo.tipo });
        esperarRechazo(respuesta, [400]);
      });

      it('400 con demasiados campos en el formulario', async () => {
        let peticion = request(obtener()).post(RUTA).set('Authorization', SECRETARIA).field('cursoId', cursoId());
        for (let i = 0; i < 20; i++) {
          peticion = peticion.field(`campo${i}`, 'x');
        }
        esperarRechazo(await peticion.attach('archivo', nominaValida().contenido, { filename: 'nomina.xlsx', contentType: nominaValida().tipo }), [400]);
      });

      it('400 si cursoId no es un UUID', async () => {
        const archivo = nominaValida();
        const respuesta = await request(obtener())
          .post(RUTA)
          .set('Authorization', SECRETARIA)
          .field('cursoId', "' OR '1'='1")
          .attach('archivo', archivo.contenido, { filename: 'nomina.xlsx', contentType: archivo.tipo });
        esperarRechazo(respuesta, [400]);
      });

      it('400 o 415 si se manda JSON en lugar del archivo', async () => {
        const respuesta = await request(obtener()).post(RUTA).set('Authorization', SECRETARIA).send({ cursoId: randomUUID(), archivo: 'UEsDBA==' });
        esperarRechazo(respuesta, [400, 415]);
      });
    });

    describe('archivos inválidos', () => {
      for (const caso of CASOS_ARCHIVO) {
        it(`${caso.estado} ${caso.codigo}: ${caso.nombre}`, async () => {
          const inicio = Date.now();
          const respuesta = await subir(caso.archivo());

          esperarRechazo(respuesta, [caso.estado]);
          expect(respuesta.body.codigo).toBe(caso.codigo);
          // Ningún archivo, ni una bomba, puede ocupar al servicio más de unos segundos
          expect(Date.now() - inicio).toBeLessThan(5000);
          // El contenido del archivo nunca vuelve al cliente
          expect(respuesta.text).not.toMatch(/etc\/passwd|<!DOCTYPE|<script>/i);
        });
      }
    });
  });
}
