import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { cedulaFicticia, conVerificadorErroneo, digitoVerificador } from '../../test/seguridad/datos-ficticios';
import { Cedula, EnlaceSeguro, esCedulaValida, esEnlaceSeguro, esTextoLibreValido, PATRON_TEXTO_SEGURO, TextoLibre } from './validadores';

// El patrón no debe rechazar nombres reales del colegio (falsos positivos) ni dejar pasar símbolos de ataque.
describe('PATRON_TEXTO_SEGURO', () => {
  it.each([
    'Matemática',
    'Lengua y Literatura',
    'Educación Cultural y Artística',
    'Ciencias Naturales (Biología)',
    'Emprendimiento y Gestión',
    'Inglés',
    '8° EGB',
    '1.º BGU',
    '9no EGB',
    'Inicial 2',
    'A',
    'Física – Química',
    'Historia/Geografía',
    "Ciencias d'Arte",
    '2026-2027',
    'Ñandú',
  ])('acepta "%s"', (texto) => {
    expect(PATRON_TEXTO_SEGURO.test(texto)).toBe(true);
  });

  it.each([
    "' OR '1'='1",
    'x; DROP TABLE materia',
    '<script>',
    'a"b',
    '${7*7}',
    '{{7*7}}',
    '=SUMA(A1)',
    'a`b',
    'a\\b',
    ' Matemática',
    'Matemática-',
    '-Matemática',
    'Mate\u0000mática',
    'Mate\nmática',
    'Materia\u202Egpj.exe',
    'Mate​mática',
  ])('rechaza %j', (texto) => {
    expect(PATRON_TEXTO_SEGURO.test(texto)).toBe(false);
  });
});

describe('esCedulaValida', () => {
  // Las cédulas válidas se generan al ejecutar: ninguna queda escrita en el repositorio
  it.each(Array.from({ length: 20 }, () => cedulaFicticia()))('acepta %s (generada con verificador correcto)', (cedula) => {
    expect(esCedulaValida(cedula)).toBe(true);
  });

  it('acepta las provincias 01 a 24 y 30 (exterior)', () => {
    for (const provincia of [...Array.from({ length: 24 }, (_, i) => i + 1), 30]) {
      const base = `${String(provincia).padStart(2, '0')}1234567`;
      expect(esCedulaValida(`${base}${digitoVerificador(base)}`)).toBe(true);
    }
  });

  it('rechaza un verificador equivocado', () => {
    for (let i = 0; i < 20; i++) {
      expect(esCedulaValida(conVerificadorErroneo(cedulaFicticia()))).toBe(false);
    }
  });

  it.each([
    ['provincia 00', '00'],
    ['provincia 25', '25'],
    ['provincia 99', '99'],
  ])('rechaza la %s', (_caso, provincia) => {
    const base = `${provincia}1234567`;
    expect(esCedulaValida(`${base}${digitoVerificador(base)}`)).toBe(false);
  });

  it('rechaza un tercer dígito de 6 a 9 (no es persona natural)', () => {
    const base = `${cedulaFicticia().slice(0, 2)}6234567`;
    expect(esCedulaValida(`${base}${digitoVerificador(base)}`)).toBe(false);
  });

  it.each([[''], ['123'], ['12345678901'], ['17abc45678'], [` ${cedulaFicticia()}`], [Number(cedulaFicticia())], [null], [undefined]])(
    'rechaza %j',
    (valor) => {
      expect(esCedulaValida(valor)).toBe(false);
    },
  );
});

describe('@Cedula', () => {
  class Registro {
    @Cedula() cedula: unknown;
  }

  it('valida con el mismo criterio y responde un mensaje sin el valor', async () => {
    const valido = Object.assign(new Registro(), { cedula: cedulaFicticia() });
    const invalido = Object.assign(new Registro(), { cedula: conVerificadorErroneo(cedulaFicticia()) });

    expect(await validate(valido)).toEqual([]);
    const [error] = await validate(invalido);
    expect(error.constraints).toEqual({ cedula: 'cedula no es una cédula válida' });
  });
});

// Texto libre (T1119-A): se guarda literal, así que acepta signos de puntuación y hasta HTML como texto,
// pero no caracteres que esconden o reordenan lo que se ve en pantalla.
describe('TextoLibre y esTextoLibreValido', () => {
  class Tarea {
    @TextoLibre(150, { minimo: 2 }) titulo: string;
    @TextoLibre(2000, { multilinea: true }) descripcion: string;
  }
  const errores = async (titulo: unknown, descripcion: unknown = 'Indicaciones'): Promise<string[]> =>
    (await validate(plainToInstance(Tarea, { titulo, descripcion }))).map((e) => e.property);

  it.each([
    'Taller 3: suma y resta',
    '¿Qué aprendimos? ¡Repaso!',
    'Proyecto #2 — Ecosistemas (grupal)',
    'Lectura "El principito", cap. 1–3',
    '<b>Prueba</b> <script>alert(1)</script>',
    "' OR '1'='1",
    'Tarea\tcon tabulador',
  ])('acepta y guarda literal %j', async (titulo) => {
    expect(await errores(titulo)).toEqual([]);
  });

  it.each([
    ['byte nulo', 'Tar\u0000ea'],
    ['campana y escape ANSI', 'Tarea\u0007\u001b[31m'],
    ['DEL', 'Tarea\u007f'],
    ['control C1', 'Tarea\u0085'],
    ['cambio de dirección (U+202E)', 'Tarea\u202Egpj.exe'],
    ['aislamiento de dirección (U+2066)', 'Tarea\u2066x'],
    ['ancho cero (U+200B)', 'Ta\u200Brea'],
    // En los extremos la quita trim(); en medio del texto se rechaza
    ['marca de orden de bytes en medio', `Ta${String.fromCodePoint(0xfeff)}rea`],
    ['salto de línea en un título', 'Tarea\nSet-Cookie: x=1'],
    ['retorno de carro en un título', 'Tarea\rX'],
    ['vacío tras recortar', '   '],
    ['muy largo', 'a'.repeat(151)],
    ['no es texto', 123],
  ])('rechaza el título con %s', async (_nombre, titulo) => {
    expect(await errores(titulo)).toContain('titulo');
  });

  it('en texto multilínea admite saltos de línea y los normaliza a \n', async () => {
    const tarea = plainToInstance(Tarea, { titulo: 'Tarea', descripcion: '  Paso 1\r\nPaso 2\rPaso 3  ' });
    expect(await validate(tarea)).toEqual([]);
    expect(tarea.descripcion).toBe('Paso 1\nPaso 2\nPaso 3');
  });

  it('en texto multilínea sigue rechazando los demás caracteres de control', async () => {
    expect(await errores('Tarea', 'Paso 1\n\u202Eoculto')).toContain('descripcion');
    expect(esTextoLibreValido('a\nb', false)).toBe(false);
    expect(esTextoLibreValido('a\nb', true)).toBe(true);
  });
});

// Enlaces (T1119-A): la PWA los convierte en vínculos, así que solo http(s)
describe('EnlaceSeguro y esEnlaceSeguro', () => {
  class Recurso {
    @EnlaceSeguro() enlaceRecurso: string;
  }

  it.each(['https://ejemplo.test/guia.pdf', 'http://ejemplo.test', 'HTTPS://ejemplo.test/a?b=1#c', 'https://ejemplo.test/ruta%20con%20espacios'])('acepta %s', async (enlace) => {
    expect(esEnlaceSeguro(enlace)).toBe(true);
    expect(await validate(plainToInstance(Recurso, { enlaceRecurso: enlace }))).toEqual([]);
  });

  it.each([
    ['javascript:', 'javascript:alert(document.cookie)'],
    ['JavaScript en mayúsculas', 'JaVaScRiPt:alert(1)'],
    ['javascript: con espacio delante', ' javascript:alert(1)'],
    ['javascript: con tabulador en medio', 'java\tscript:alert(1)'],
    ['data: con HTML', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['file:', 'file:///etc/passwd'],
    ['relativo al protocolo', '//malicioso.test/x'],
    ['sin protocolo', 'ejemplo.test/guia'],
    ['con usuario y clave', 'https://usuario:clave@ejemplo.test'],
    ['con usuario engañoso', 'https://banco.test@malicioso.test'],
    ['con espacios', 'https://ejemplo.test/a b'],
    ['con salto de línea', 'https://ejemplo.test/\nSet-Cookie: x=1'],
    ['con byte nulo', 'https://ejemplo.test/\u0000'],
    ['con cambio de dirección', 'https://ejemplo.test/\u202Egpj.exe'],
    ['sin dominio', 'https://'],
    ['de más de 255 caracteres', `https://ejemplo.test/${'a'.repeat(250)}`],
    ['que no es texto', { href: 'https://ejemplo.test' }],
  ])('rechaza un enlace %s', async (_nombre, enlace) => {
    expect(esEnlaceSeguro(enlace)).toBe(false);
    expect(await validate(plainToInstance(Recurso, { enlaceRecurso: enlace }))).not.toEqual([]);
  });
});
