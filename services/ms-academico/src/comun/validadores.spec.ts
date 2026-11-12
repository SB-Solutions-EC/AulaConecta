import { PATRON_TEXTO_SEGURO } from './validadores';

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
    'Materia‮gpj.exe',
    'Mate​mática',
  ])('rechaza %j', (texto) => {
    expect(PATRON_TEXTO_SEGURO.test(texto)).toBe(false);
  });
});
