// Catálogo de entradas hostiles para los endpoints académicos.
// Cada lista se aplica a todos los campos de su tipo en cada endpoint.

export type TipoCampo = 'texto' | 'uuid' | 'fecha' | 'booleano';

export interface Entrada {
  nombre: string;
  valor: unknown;
}

const TIPOS_EQUIVOCADOS: Entrada[] = [
  { nombre: 'null', valor: null },
  { nombre: 'número', valor: 123 },
  { nombre: 'arreglo', valor: ['a', 'b'] },
  { nombre: 'objeto', valor: { a: 1 } },
  // Operadores al estilo NoSQL que algunos ORM interpretan como filtro
  { nombre: 'operador $ne', valor: { $ne: null } },
  { nombre: 'operador $gt', valor: { $gt: '' } },
];

/**
 * Inyecciones dentro de un texto. El servidor puede rechazarlas (400) o guardarlas tal cual
 * (consultas parametrizadas); lo que nunca puede pasar es un 500 ni que cambien otros datos.
 */
export const INYECCIONES_TEXTO: Entrada[] = [
  { nombre: 'SQL tautología', valor: "' OR '1'='1" },
  { nombre: 'SQL comentario', valor: "Matemática'--" },
  { nombre: 'SQL consulta apilada', valor: "x'); DROP TABLE materia; --" },
  { nombre: 'SQL UNION', valor: "' UNION SELECT usuario_id, NULL FROM persona --" },
  { nombre: 'SQL dólar de PostgreSQL', valor: '$$; DELETE FROM curso; $$' },
  { nombre: 'SQL espera ciega', valor: "'; SELECT pg_sleep(5); --" },
  { nombre: 'XSS etiqueta script', valor: '<script>alert(1)</script>' },
  { nombre: 'XSS atributo', valor: '"><img src=x onerror=alert(1)>' },
  { nombre: 'plantilla ${}', valor: '${7*7}' },
  { nombre: 'plantilla {{}}', valor: '{{7*7}}' },
  { nombre: 'recorrido de rutas', valor: '../../etc/passwd' },
  { nombre: 'fórmula de hoja de cálculo', valor: '=HYPERLINK("http://x.test","clic")' },
];

/** Textos que siempre deben rechazarse con 400. */
const TEXTOS_INVALIDOS: Entrada[] = [
  ...TIPOS_EQUIVOCADOS,
  { nombre: 'vacío', valor: '' },
  { nombre: 'solo espacios', valor: '    ' },
  { nombre: 'muy largo (10 000 caracteres)', valor: 'a'.repeat(10_000) },
  // PostgreSQL no admite \0 en un text: sin validar termina en 500
  { nombre: 'byte nulo', valor: 'Mate\u0000mática' },
  { nombre: 'salto de línea (CRLF)', valor: 'Matemática\r\nSet-Cookie: x=1' },
  { nombre: 'caracteres de control', valor: 'Mate\u0007mática\u001b[31m' },
  { nombre: 'invertir dirección (U+202E)', valor: 'Materia‮gpj.exe' },
];

const UUIDS_INVALIDOS: Entrada[] = [
  ...TIPOS_EQUIVOCADOS,
  { nombre: 'vacío', valor: '' },
  { nombre: 'no es UUID', valor: 'no-es-uuid' },
  { nombre: 'número como texto', valor: '1' },
  { nombre: 'SQL tautología', valor: "' OR '1'='1" },
  { nombre: 'UUID con SQL al final', valor: "6f1c2e8a-3b4d-4c5e-8f9a-0b1c2d3e4f5a' OR '1'='1" },
  { nombre: 'UUID sin guiones', valor: '6f1c2e8a3b4d4c5e8f9a0b1c2d3e4f5a' },
];

const FECHAS_INVALIDAS: Entrada[] = [
  ...TIPOS_EQUIVOCADOS,
  { nombre: 'vacía', valor: '' },
  { nombre: 'texto libre', valor: 'mañana' },
  { nombre: 'mes 13', valor: '2026-13-01' },
  { nombre: '30 de febrero', valor: '2026-02-30' },
  { nombre: 'formato DD/MM/AAAA', valor: '01/09/2026' },
  { nombre: 'con hora', valor: '2026-09-01T00:00:00Z' },
  { nombre: 'SQL', valor: "2026-09-01' OR '1'='1" },
];

const BOOLEANOS_INVALIDOS: Entrada[] = [
  { nombre: 'texto "true"', valor: 'true' },
  { nombre: 'número 1', valor: 1 },
  { nombre: 'texto "sí"', valor: 'sí' },
  { nombre: 'objeto', valor: { $ne: false } },
  { nombre: 'arreglo', valor: [true] },
];

export const INVALIDOS_POR_TIPO: Record<TipoCampo, Entrada[]> = {
  texto: TEXTOS_INVALIDOS,
  uuid: UUIDS_INVALIDOS,
  fecha: FECHAS_INVALIDAS,
  booleano: BOOLEANOS_INVALIDOS,
};

/** Valores en la consulta (?campo=valor) que un filtro UUID debe rechazar. */
export const CONSULTAS_UUID_INVALIDAS: string[] = [
  'no-es-uuid',
  "' OR '1'='1",
  '1; DROP TABLE curso',
  "6f1c2e8a-3b4d-4c5e-8f9a-0b1c2d3e4f5a' OR '1'='1",
  '%00',
];

/** Rastros que delatan un error interno si aparecen en una respuesta. */
export const RASTROS_INTERNOS: RegExp[] = [
  /\bat .+\.(ts|js):\d+/, // pila de llamadas
  /node_modules/,
  /QueryFailedError|PrismaClient|SequelizeDatabaseError/i,
  /syntax error at or near/i,
  /relation ".+" does not exist/i,
  /duplicate key value/i,
  /violates (foreign key|unique|not-null|check) constraint/i,
  /Unexpected token|in JSON at position/i,
];
