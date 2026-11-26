import { describe, expect, it, vi } from 'vitest';
import type { ClienteHttp } from './clienteHttp';
import { ServicioParametrosApi } from './parametrosApi';

describe('ServicioParametrosApi (RNF-10)', () => {
  it('lista parámetros y actualiza un parámetro vía PUT /parametros', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const putMock = vi.fn().mockResolvedValue({
      id: 'par-1',
      clave: 'ponderaciones_calificaciones',
      valor: { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 },
      version: 2,
    });
    const clienteSimulado = {
      get: getMock,
      put: putMock,
    } as unknown as ClienteHttp;
    const api = new ServicioParametrosApi(clienteSimulado);

    await api.listarParametros();
    expect(getMock).toHaveBeenCalledWith('/api/academico/parametros');

    await api.actualizarParametro({
      clave: 'ponderaciones_calificaciones',
      valor: { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 },
      version: 1,
    });
    expect(putMock).toHaveBeenCalledWith('/api/academico/parametros', {
      clave: 'ponderaciones_calificaciones',
      valor: { aportes: 60, proyecto: 20, examen: 20, minimoAprobacion: 7 },
      version: 1,
    });
  });
});
