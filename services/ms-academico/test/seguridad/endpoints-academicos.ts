import { randomUUID } from 'node:crypto';
import { TipoCampo } from './entradas-maliciosas';

// Endpoints de RF-06 (cursos, paralelos y materias) y RF-07 (fechas del año lectivo y de sus trimestres)
// según openapi/ms-academico.yaml.
// contrato.spec.ts comprueba que estos datos sigan coincidiendo con el contrato.

export const ROLES = ['ADMIN', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE'];

export interface Campo {
  nombre: string;
  tipo: TipoCampo;
  requerido: boolean;
}

export type Cuerpo = Record<string, unknown>;
/** Crea un recurso por la API con un token de ADMIN y devuelve la respuesta 201. */
export type CrearRecurso = (ruta: string, cuerpo: Cuerpo) => Promise<Cuerpo>;

export interface ReglaNegocio {
  nombre: string;
  /** Estados aceptados como rechazo correcto. */
  estados: number[];
  cuerpo: (crear: CrearRecurso, valido: Cuerpo) => Promise<Cuerpo>;
}

export interface EndpointCreacion {
  operacion: string;
  ruta: string;
  esquema: string;
  rolesPermitidos: string[];
  campos: Campo[];
  /** Ruta GET donde debe aparecer lo creado, para comprobar que se guardó tal cual. */
  rutaListado: string;
  cuerpoValido: (crear: CrearRecurso) => Promise<Cuerpo>;
  reglas: ReglaNegocio[];
}

export interface EndpointListado {
  operacion: string;
  ruta: string;
  /** Parámetros de consulta con formato UUID. */
  filtrosUuid: string[];
}

// Valores únicos en cada ejecución para no chocar con datos que ya existan
let secuencia = 0;
const siguiente = (): number => ++secuencia;
const anioBase = 2100 + Math.floor(Math.random() * 5000);

function anioLectivoValido(): Cuerpo {
  const anio = anioBase + siguiente();
  return { id: randomUUID(), nombre: `${anio}-${anio + 1}`, inicio: `${anio}-09-01`, fin: `${anio + 1}-07-15`, activo: true };
}

const duplicado = async (crear: CrearRecurso, valido: Cuerpo, ruta: string): Promise<Cuerpo> => {
  await crear(ruta, valido);
  return { ...valido, id: randomUUID() };
};

export const ANIOS_LECTIVOS: EndpointCreacion = {
  operacion: 'crearAnioLectivo',
  ruta: '/anios-lectivos',
  esquema: 'SolicitudAnioLectivo',
  rolesPermitidos: ['ADMIN'],
  campos: [
    { nombre: 'id', tipo: 'uuid', requerido: false },
    { nombre: 'nombre', tipo: 'texto', requerido: true },
    { nombre: 'inicio', tipo: 'fecha', requerido: true },
    { nombre: 'fin', tipo: 'fecha', requerido: true },
    { nombre: 'activo', tipo: 'booleano', requerido: false },
  ],
  rutaListado: '/anios-lectivos',
  cuerpoValido: async () => anioLectivoValido(),
  reglas: [
    {
      nombre: 'la fecha de fin es anterior al inicio',
      estados: [400],
      cuerpo: async (_crear, valido) => ({ ...valido, inicio: valido.fin, fin: valido.inicio }),
    },
    { nombre: 'la fecha de fin es igual al inicio', estados: [400], cuerpo: async (_crear, valido) => ({ ...valido, fin: valido.inicio }) },
    { nombre: 'el nombre ya existe', estados: [400, 409], cuerpo: (crear, valido) => duplicado(crear, valido, '/anios-lectivos') },
  ],
};

export const CURSOS: EndpointCreacion = {
  operacion: 'crearCurso',
  ruta: '/cursos',
  esquema: 'SolicitudCurso',
  rolesPermitidos: ['ADMIN'],
  campos: [
    { nombre: 'id', tipo: 'uuid', requerido: false },
    { nombre: 'anioLectivoId', tipo: 'uuid', requerido: true },
    { nombre: 'nivel', tipo: 'texto', requerido: true },
    { nombre: 'paralelo', tipo: 'texto', requerido: true },
  ],
  rutaListado: '/cursos',
  cuerpoValido: async (crear) => {
    const anio = await crear('/anios-lectivos', anioLectivoValido());
    return { id: randomUUID(), anioLectivoId: anio.id, nivel: `Nivel ${siguiente()} EGB`, paralelo: 'A' };
  },
  reglas: [
    {
      nombre: 'el año lectivo no existe',
      estados: [400, 404, 409, 422],
      cuerpo: async (_crear, valido) => ({ ...valido, anioLectivoId: randomUUID() }),
    },
    { nombre: 'el paralelo ya existe en ese nivel', estados: [400, 409], cuerpo: (crear, valido) => duplicado(crear, valido, '/cursos') },
  ],
};

export const MATERIAS: EndpointCreacion = {
  operacion: 'crearMateria',
  ruta: '/materias',
  esquema: 'SolicitudMateria',
  rolesPermitidos: ['ADMIN'],
  campos: [
    { nombre: 'id', tipo: 'uuid', requerido: false },
    { nombre: 'codigo', tipo: 'texto', requerido: true },
    { nombre: 'nombre', tipo: 'texto', requerido: true },
    { nombre: 'area', tipo: 'texto', requerido: false },
  ],
  rutaListado: '/materias',
  cuerpoValido: async () => {
    const n = siguiente();
    return { id: randomUUID(), codigo: `M${n}`, nombre: `Materia ${n}`, area: 'Ciencias Naturales' };
  },
  reglas: [
    { nombre: 'la materia ya existe', estados: [400, 409], cuerpo: (crear, valido) => duplicado(crear, valido, '/materias') },
    {
      nombre: 'el código ya lo usa otra materia',
      estados: [400, 409],
      cuerpo: async (crear, valido) => {
        await crear('/materias', valido);
        return { ...valido, id: randomUUID(), nombre: `${String(valido.nombre)} B` };
      },
    },
  ],
};

/** Primer trimestre de un año lectivo nuevo: del 1 de septiembre al 30 de noviembre. */
async function trimestreValido(crear: CrearRecurso): Promise<Cuerpo> {
  const anio = await crear('/anios-lectivos', anioLectivoValido());
  const inicioAnio = String(anio.inicio);
  const año = inicioAnio.slice(0, 4);
  return { id: randomUUID(), anioLectivoId: anio.id, numero: 1, inicio: inicioAnio, fin: `${año}-11-30` };
}

export const PERIODOS: EndpointCreacion = {
  operacion: 'crearPeriodo',
  ruta: '/periodos',
  esquema: 'SolicitudPeriodo',
  rolesPermitidos: ['ADMIN'],
  campos: [
    { nombre: 'id', tipo: 'uuid', requerido: false },
    { nombre: 'anioLectivoId', tipo: 'uuid', requerido: true },
    { nombre: 'numero', tipo: 'trimestre', requerido: true },
    { nombre: 'inicio', tipo: 'fecha', requerido: true },
    { nombre: 'fin', tipo: 'fecha', requerido: true },
  ],
  rutaListado: '/periodos',
  cuerpoValido: trimestreValido,
  reglas: [
    { nombre: 'la fecha de fin es anterior al inicio', estados: [400], cuerpo: async (_crear, valido) => ({ ...valido, inicio: valido.fin, fin: valido.inicio }) },
    {
      // RF-07: un trimestre fuera del año lectivo se rechaza
      nombre: 'el trimestre termina después del año lectivo',
      estados: [400],
      cuerpo: async (_crear, valido) => ({ ...valido, fin: `${Number(String(valido.inicio).slice(0, 4)) + 2}-01-15` }),
    },
    {
      // RF-07: dos trimestres no se superponen
      nombre: 'se superpone con otro trimestre del mismo año',
      estados: [400, 409],
      cuerpo: async (crear, valido) => {
        await crear('/periodos', valido);
        return { ...valido, id: randomUUID(), numero: 2 };
      },
    },
    { nombre: 'el trimestre ya existe en el año', estados: [400, 409], cuerpo: (crear, valido) => duplicado(crear, valido, '/periodos') },
    {
      nombre: 'el año lectivo no existe',
      estados: [400, 404, 409, 422],
      cuerpo: async (_crear, valido) => ({ ...valido, anioLectivoId: randomUUID() }),
    },
  ],
};

export const CREACIONES: EndpointCreacion[] = [ANIOS_LECTIVOS, PERIODOS, CURSOS, MATERIAS];

export const LISTADOS: EndpointListado[] = [
  { operacion: 'listarAniosLectivos', ruta: '/anios-lectivos', filtrosUuid: [] },
  { operacion: 'listarPeriodos', ruta: '/periodos', filtrosUuid: ['anioLectivoId'] },
  { operacion: 'listarCursos', ruta: '/cursos', filtrosUuid: ['anioLectivoId'] },
  { operacion: 'listarMaterias', ruta: '/materias', filtrosUuid: [] },
];
