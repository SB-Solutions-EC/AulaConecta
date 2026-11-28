import { describe, expect, it, vi } from 'vitest';
import type { ClienteHttp } from './clienteHttp';
import { ServicioAuditoriaNotasApi } from './auditoriaNotasApi';

describe('ServicioAuditoriaNotasApi (RNF-09)', () => {
  it('consulta el historial de cambios de una calificación y la auditoría de calificaciones', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { get: getMock } as unknown as ClienteHttp;
    const api = new ServicioAuditoriaNotasApi(clienteSimulado);

    await api.listarHistorialNota('cal-123');
    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/auditoria?entidad=CALIFICACION&entidadId=cal-123',
    );

    await api.listarAuditoriaCalificaciones();
    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/auditoria?entidad=CALIFICACION',
    );
  });
});
