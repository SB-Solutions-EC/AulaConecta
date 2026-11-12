import { BadRequestException, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { ExcepcionApi } from './excepcion-api';
import { FiltroErrores } from './filtro-errores';

describe('FiltroErrores', () => {
  const filtro = new FiltroErrores();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respeta el código, el mensaje y los detalles de una ExcepcionApi', () => {
    const { estado, cuerpo } = filtro.traducir(new ExcepcionApi(409, 'CUPO_LLENO', 'El paralelo está lleno.', ['paralelo']));

    expect(estado).toBe(409);
    expect(cuerpo).toMatchObject({ codigo: 'CUPO_LLENO', mensaje: 'El paralelo está lleno.', detalles: ['paralelo'] });
    expect(Number.isNaN(Date.parse(cuerpo.timestamp))).toBe(false);
  });

  it('omite detalles vacíos', () => {
    expect(filtro.traducir(new ExcepcionApi(400, 'DATOS_INVALIDOS', 'x', [])).cuerpo).not.toHaveProperty('detalles');
  });

  it('cambia el mensaje de las excepciones de Nest por uno genérico', () => {
    // Así llega un JSON mal formado: el mensaje trae el fragmento que falló
    const { estado, cuerpo } = filtro.traducir(new BadRequestException('Unexpected token } in JSON at position 10'));

    expect(estado).toBe(400);
    expect(cuerpo).toEqual({ codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos enviados no son válidos.', timestamp: cuerpo.timestamp });
    expect(filtro.traducir(new NotFoundException('Cannot GET /x')).cuerpo.codigo).toBe('NO_ENCONTRADO');
  });

  it('un 4xx sin código propio conserva el estado y usa el texto genérico de 400', () => {
    const { estado, cuerpo } = filtro.traducir(new HttpException('Soy una tetera', 418));

    expect(estado).toBe(418);
    expect(cuerpo.codigo).toBe('DATOS_INVALIDOS');
  });

  it.each([
    ['un Error', new Error('relation "materia" does not exist')],
    ['un texto', 'falló la conexión a postgres://usuario@db'],
    ['un 503 de Nest', new HttpException('upstream caído', 503)],
  ])('ante %s responde ERROR_INTERNO sin el detalle y lo deja en el registro', (_caso, error) => {
    const registro = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { estado, cuerpo } = filtro.traducir(error);

    expect(estado).toBeGreaterThanOrEqual(500);
    expect(cuerpo.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(cuerpo)).not.toMatch(/relation|postgres|upstream/);
    expect(registro).toHaveBeenCalledOnce();
  });
});
