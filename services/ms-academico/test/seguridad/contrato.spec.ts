import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { CREACIONES, EndpointCreacion, LISTADOS } from './endpoints-academicos';
import { TipoCampo } from './entradas-maliciosas';

// Si el contrato cambia (campo nuevo, ruta renombrada) y la suite no, las pruebas de seguridad
// dejarían de cubrir algo sin que nadie lo note. Estas pruebas lo detectan.

interface Esquema {
  type?: string;
  format?: string;
  required?: string[];
  properties?: Record<string, Esquema>;
  $ref?: string;
}
interface Parametro {
  name: string;
  in: string;
  schema: Esquema;
}
interface Operacion {
  operationId: string;
  tags?: string[];
  parameters?: Parametro[];
  requestBody?: { content: Record<string, { schema: Esquema }> };
}
interface Contrato {
  paths: Record<string, Record<string, Operacion>>;
  components: { schemas: Record<string, Esquema> };
}

const contrato = parse(readFileSync(resolve(__dirname, '../../../../openapi/ms-academico.yaml'), 'utf8')) as Contrato;

function tipoEnContrato(propiedad: Esquema): TipoCampo | string {
  if (propiedad.type === 'boolean') {
    return 'booleano';
  }
  if (propiedad.type === 'string') {
    return { uuid: 'uuid', date: 'fecha' }[propiedad.format ?? ''] ?? (propiedad.format ? `string/${propiedad.format}` : 'texto');
  }
  return String(propiedad.type);
}

function esquemaDeSolicitud(endpoint: EndpointCreacion): Esquema {
  const operacion = contrato.paths[endpoint.ruta]?.post;
  expect(operacion?.operationId).toBe(endpoint.operacion);
  const referencia = operacion?.requestBody?.content['application/json']?.schema.$ref;
  expect(referencia).toBe(`#/components/schemas/${endpoint.esquema}`);
  return contrato.components.schemas[endpoint.esquema];
}

describe('La suite de seguridad coincide con openapi/ms-academico.yaml', () => {
  for (const endpoint of CREACIONES) {
    it(`POST ${endpoint.ruta} prueba exactamente los campos de ${endpoint.esquema}`, () => {
      const esquema = esquemaDeSolicitud(endpoint);

      const enContrato = Object.entries(esquema.properties ?? {}).map(([nombre, propiedad]) => [nombre, tipoEnContrato(propiedad)]);
      expect(Object.fromEntries(endpoint.campos.map((c) => [c.nombre, c.tipo]))).toEqual(Object.fromEntries(enContrato));
      expect(endpoint.campos.filter((c) => c.requerido).map((c) => c.nombre).sort()).toEqual([...(esquema.required ?? [])].sort());
    });
  }

  for (const endpoint of LISTADOS) {
    it(`GET ${endpoint.ruta} prueba todos sus filtros UUID`, () => {
      const operacion = contrato.paths[endpoint.ruta]?.get;
      expect(operacion?.operationId).toBe(endpoint.operacion);

      const filtros = (operacion?.parameters ?? []).filter((p) => p.in === 'query' && p.schema.format === 'uuid').map((p) => p.name);
      expect(endpoint.filtrosUuid).toEqual(filtros);
    });
  }

  it('cubre todas las operaciones de RF-06 y RF-07 del contrato', () => {
    // Los días no dictados son RF-08 y tienen su propia tarea
    const operaciones = Object.entries(contrato.paths)
      .filter(([ruta]) => !ruta.includes('dias-no-dictados'))
      .flatMap(([, metodos]) => Object.values(metodos))
      .filter((operacion) => operacion.tags?.includes('Configuración Académica'))
      .map((operacion) => operacion.operationId)
      .sort();

    expect([...CREACIONES, ...LISTADOS].map((e) => e.operacion).sort()).toEqual(operaciones);
  });
});
