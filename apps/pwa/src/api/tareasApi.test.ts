import { describe, expect, it, vi } from 'vitest';
import type { ClienteHttp } from './clienteHttp';
import { ServicioTareasApi } from './tareasApi';

describe('ServicioTareasApi (RF-19)', () => {
  it('lista tareas filtradas por curso, materia y tipo', async () => {
    const getMock = vi.fn().mockResolvedValue([]);
    const clienteSimulado = { get: getMock } as unknown as ClienteHttp;
    const api = new ServicioTareasApi(clienteSimulado);

    await api.listarTareas({
      cursoId: 'cur-1',
      materiaId: 'mat-1',
      tipo: 'PROYECTO',
    });

    expect(getMock).toHaveBeenCalledWith(
      '/api/academico/tareas?cursoId=cur-1&materiaId=mat-1&tipo=PROYECTO',
    );
  });

  it('crea una tarea, envía una entrega y la califica mediante los endpoints esperados', async () => {
    const postMock = vi.fn().mockResolvedValue({ id: 'tar-1' });
    const patchMock = vi.fn().mockResolvedValue({ id: 'ent-1' });
    const clienteSimulado = {
      post: postMock,
      patch: patchMock,
    } as unknown as ClienteHttp;
    const api = new ServicioTareasApi(clienteSimulado);

    await api.crearTarea({
      titulo: '  Taller de fracciones  ',
      descripcion: '  Resolver ejercicios 1 al 10  ',
      tipo: 'TAREA',
      cursoId: 'cur-1',
      materiaId: 'mat-1',
      periodoId: 'per-1',
      fechaEntrega: '2026-11-28',
      puntajeMaximo: 10,
    });

    expect(postMock).toHaveBeenCalledWith('/api/academico/tareas', {
      titulo: 'Taller de fracciones',
      descripcion: 'Resolver ejercicios 1 al 10',
      tipo: 'TAREA',
      cursoId: 'cur-1',
      materiaId: 'mat-1',
      periodoId: 'per-1',
      fechaEntrega: '2026-11-28',
      puntajeMaximo: 10,
    });

    await api.enviarEntrega({
      tareaId: 'tar-1',
      comentario: '  Adjunto resolución  ',
      enlaceAdjunto: ' https://ejemplo.local/archivo.pdf ',
    });

    expect(postMock).toHaveBeenCalledWith('/api/academico/tareas/tar-1/entregas', {
      estudianteId: undefined,
      nombreEstudiante: undefined,
      comentario: 'Adjunto resolución',
      enlaceAdjunto: 'https://ejemplo.local/archivo.pdf',
    });

    await api.calificarEntrega('ent-1', {
      calificacion: 9.5,
      observacionDocente: '  Muy bien  ',
    });

    expect(patchMock).toHaveBeenCalledWith(
      '/api/academico/entregas/ent-1/calificar',
      {
        calificacion: 9.5,
        observacionDocente: 'Muy bien',
      },
    );
  });
});
