import { describe, expect, it, vi } from 'vitest';
import { ServicioCalificacionesApi } from './calificacionesApi';
import type { ClienteHttp } from './clienteHttp';

describe('ServicioCalificacionesApi (RF-17, RF-18)', () => {
  it('consulta la libreta filtrada por curso, materia y periodo', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { get: getMock } as unknown as ClienteHttp;
    const api = new ServicioCalificacionesApi(clienteSimulado);

    await api.listarLibreta({
      cursoId: 'curso-1',
      materiaId: 'mat-1',
      periodoId: 'per-1',
    });

    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/calificaciones?cursoId=curso-1&materiaId=mat-1&periodoId=per-1',
    );
  });

  it('envía un lote de calificaciones al endpoint /lote mediante PUT', async () => {
    const putMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { put: putMock } as unknown as ClienteHttp;
    const api = new ServicioCalificacionesApi(clienteSimulado);

    const solicitudes = [
      {
        matriculaId: 'matr-1',
        materiaId: 'mat-1',
        periodoId: 'per-1',
        bloque1: [8, 9, 8.5, 9, 8.5],
        bloque2: [9, 8.5, 9, 9, 9],
        refuerzo: null,
        proyecto: 9,
        examen: 9.5,
      },
    ];

    await api.guardarLote(solicitudes);

    expect(putMock).toHaveBeenCalledWith('/api/academico/calificaciones/lote', {
      calificaciones: solicitudes,
    });
  });
});
