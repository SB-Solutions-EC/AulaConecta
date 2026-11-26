import { describe, expect, it, vi } from 'vitest';
import type { ClienteHttp } from './clienteHttp';
import { ServicioComportamientoApi } from './comportamientoApi';

describe('ServicioComportamientoApi (RF-22)', () => {
  it('lista comportamientos filtrados por matrícula y trimestre', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { get: getMock } as unknown as ClienteHttp;
    const api = new ServicioComportamientoApi(clienteSimulado);

    await api.listarComportamientos({
      matriculaId: 'matr-1',
      trimestre: 2,
    });

    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/comportamientos?matriculaId=matr-1&trimestre=2',
    );
  });

  it('guarda los 9 indicadores de comportamiento vía PUT /comportamientos', async () => {
    const putMock = vi.fn().mockResolvedValue({ id: 'comp-1' });
    const clienteSimulado = { put: putMock } as unknown as ClienteHttp;
    const api = new ServicioComportamientoApi(clienteSimulado);

    const indicadores = {
      cog1: 'SIEMPRE',
      cog2: 'SIEMPRE',
      cog3: 'FRECUENTEMENTE',
      cog4: 'SIEMPRE',
      soc1: 'SIEMPRE',
      soc2: 'FRECUENTEMENTE',
      soc3: 'SIEMPRE',
      soc4: 'SIEMPRE',
      soc5: 'SIEMPRE',
    } as const;

    await api.guardarComportamiento({
      matriculaId: 'matr-1',
      trimestre: 1,
      indicadores: { ...indicadores },
      version: 0,
    });

    expect(putMock).toHaveBeenCalledWith('/api/academico/comportamientos', {
      matriculaId: 'matr-1',
      trimestre: 1,
      indicadores,
      version: 0,
    });
  });
});
