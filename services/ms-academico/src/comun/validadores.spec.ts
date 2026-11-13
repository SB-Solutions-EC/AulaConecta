import { validate } from 'class-validator';
import { cedulaFicticia, conVerificadorErroneo, digitoVerificador } from '../../test/seguridad/datos-ficticios';
import { Cedula, esCedulaValida, PATRON_TEXTO_SEGURO } from './validadores';

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
