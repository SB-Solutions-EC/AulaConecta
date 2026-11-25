import { describe, expect, it, vi } from 'vitest';
import type { ClienteHttp } from './clienteHttp';
import { ServicioAsistenciaApi } from './asistenciaApi';

describe('ServicioAsistenciaApi (RF-21)', () => {
  it('lista asistencias filtradas por asignación, matrícula y fecha', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { get: getMock } as unknown as ClienteHttp;
    const api = new ServicioAsistenciaApi(clienteSimulado);

    await api.listarAsistencias({
      asignacionId: 'asig-1',
      matriculaId: 'matr-1',
      fecha: '2026-05-15',
    });

    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/asistencias?asignacionId=asig-1&matriculaId=matr-1&fecha=2026-05-15',
    );
  });

  it('guarda asistencia con justificación recortada y confirmación cuando corresponde', async () => {
    const putMock = vi.fn().mockResolvedValue({ id: 'asist-1' });
    const postMock = vi.fn().mockResolvedValue({ id: 'asist-1' });
    const clienteSimulado = {
      put: putMock,
      post: postMock,
    } as unknown as ClienteHttp;
    const api = new ServicioAsistenciaApi(clienteSimulado);

    await api.guardarAsistencia({
      asignacionId: 'asig-1',
      matriculaId: 'matr-1',
      fecha: '2026-05-15',
      estado: 'JUSTIFICADA',
      justificacion: '  Certificado médico  ',
      version: 1,
    });

    expect(putMock).toHaveBeenCalledWith('/api/academico/asistencias', {
      asignacionId: 'asig-1',
      matriculaId: 'matr-1',
      fecha: '2026-05-15',
      estado: 'JUSTIFICADA',
      justificacion: 'Certificado médico',
      version: 1,
    });

    await api.guardarAsistencia({
      id: 'asist-1',
      asignacionId: 'asig-1',
      matriculaId: 'matr-1',
      fecha: '2026-05-15',
      estado: 'FALTA',
      justificacion: '   ',
      confirmar: true,
      version: 2,
    });

    expect(putMock).toHaveBeenCalledWith('/api/academico/asistencias', {
      id: 'asist-1',
      asignacionId: 'asig-1',
      matriculaId: 'matr-1',
      fecha: '2026-05-15',
      estado: 'FALTA',
      justificacion: null,
      confirmar: true,
      version: 2,
    });

    await api.solicitarJustificacion('asist-1', '  Cita médica  ');

    expect(postMock).toHaveBeenCalledWith(
      '/api/academico/asistencias/asist-1/justificacion',
      { motivo: 'Cita médica' },
    );
  });
});
