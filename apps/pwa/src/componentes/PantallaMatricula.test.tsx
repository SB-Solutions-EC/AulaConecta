import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorHttpApi, type ClienteHttp } from '../api/clienteHttp';
import {
  ServicioMatriculasApi,
  type ContactoNotificacion,
  type Matricula,
  type PersonaAcademica,
} from '../api/matriculasApi';
import { PantallaMatricula } from './PantallaMatricula';

const CEDULA_ESTUDIANTE_SINTETICA = '9900000001';
const CEDULA_REPRESENTANTE_SINTETICA = '9900000002';
const WHATSAPP_E164_SINTETICO = '+593000000000';

describe('ServicioMatriculasApi', () => {
  it('invoca los endpoints de ms-academico y ms-notificaciones según OpenAPI', async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
    } as unknown as ClienteHttp;

    const api = new ServicioMatriculasApi(httpMock);

    await api.listarEstudiantes('Salazar');
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/academico/personas?tipo=ESTUDIANTE&q=Salazar',
    );

    await api.listarRepresentantes();
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/academico/personas?tipo=REPRESENTANTE',
    );

    await api.crearPersona({
      tipo: 'ESTUDIANTE',
      nombres: 'Mateo',
      apellidos: 'Salazar',
      cedula: CEDULA_ESTUDIANTE_SINTETICA,
    });
    expect(httpMock.post).toHaveBeenCalledWith('/api/academico/personas', {
      tipo: 'ESTUDIANTE',
      nombres: 'Mateo',
      apellidos: 'Salazar',
      cedula: CEDULA_ESTUDIANTE_SINTETICA,
    });

    await api.crearRepresentacion({
      estudianteId: 'est-1',
      representanteId: 'rep-1',
      parentesco: 'Madre',
    });
    expect(httpMock.post).toHaveBeenCalledWith('/api/academico/representaciones', {
      estudianteId: 'est-1',
      representanteId: 'rep-1',
      parentesco: 'Madre',
    });

    await api.listarMatriculas({ cursoId: 'cur-1' });
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/academico/matriculas?cursoId=cur-1',
    );

    await api.crearMatricula({ estudianteId: 'est-1', cursoId: 'cur-1' });
    expect(httpMock.post).toHaveBeenCalledWith('/api/academico/matriculas', {
      estudianteId: 'est-1',
      cursoId: 'cur-1',
    });

    await api.listarContactos({ estudianteId: 'est-1' });
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/notificaciones/contactos?estudianteId=est-1',
    );

    await api.crearContacto({
      representanteId: 'rep-1',
      estudianteId: 'est-1',
      whatsapp: WHATSAPP_E164_SINTETICO,
      autorizaAvisos: true,
    });
    expect(httpMock.post).toHaveBeenCalledWith('/api/notificaciones/contactos', {
      representanteId: 'rep-1',
      estudianteId: 'est-1',
      whatsapp: WHATSAPP_E164_SINTETICO,
      autorizaAvisos: true,
    });

    await api.actualizarConsentimiento('cnt-1', {
      autorizaAvisos: false,
      version: 1,
    });
    expect(httpMock.patch).toHaveBeenCalledWith(
      '/api/notificaciones/contactos/cnt-1/consentimiento',
      { autorizaAvisos: false, version: 1 },
    );
  });
});

describe('PantallaMatricula', () => {
  function crearServiciosMock() {
    const estudiantes: PersonaAcademica[] = [];
    const representantes: PersonaAcademica[] = [];
    const matriculas: Matricula[] = [];
    const contactos: ContactoNotificacion[] = [];

    const servicioMatriculas = {
      listarEstudiantes: vi.fn(async () => [...estudiantes]),
      listarRepresentantes: vi.fn(async () => [...representantes]),
      crearPersona: vi.fn(async (solicitud) => {
        const persona: PersonaAcademica = {
          id: `${solicitud.tipo.toLowerCase()}-${estudiantes.length + representantes.length + 1}`,
          usuarioId: `usr-${estudiantes.length + representantes.length + 1}`,
          tipo: solicitud.tipo,
          nombres: solicitud.nombres,
          apellidos: solicitud.apellidos,
          version: 1,
        };
        if (solicitud.tipo === 'ESTUDIANTE') {
          estudiantes.push(persona);
        } else {
          representantes.push(persona);
        }
        return persona;
      }),
      crearRepresentacion: vi.fn(async (solicitud) => ({
        id: 'rel-1',
        ...solicitud,
        version: 1,
      })),
      listarMatriculas: vi.fn(async () => [...matriculas]),
      crearMatricula: vi.fn(async (solicitud) => {
        const nueva: Matricula = {
          id: `mat-${matriculas.length + 1}`,
          estudianteId: solicitud.estudianteId,
          cursoId: solicitud.cursoId,
          estado: 'ACTIVA',
          version: 1,
        };
        matriculas.push(nueva);
        return nueva;
      }),
      listarContactos: vi.fn(async () => [...contactos]),
      crearContacto: vi.fn(async (solicitud) => {
        const nuevo: ContactoNotificacion = {
          id: `cnt-${contactos.length + 1}`,
          representanteId: solicitud.representanteId,
          estudianteId: solicitud.estudianteId,
          whatsapp: solicitud.whatsapp,
          autorizaAvisos: solicitud.autorizaAvisos,
          fechaAutorizacion: solicitud.autorizaAvisos
            ? '2026-11-12T10:00:00Z'
            : null,
          fechaBaja: null,
          version: 1,
        };
        contactos.push(nuevo);
        return nuevo;
      }),
      actualizarConsentimiento: vi.fn(async (contactoId, solicitud) => {
        const idx = contactos.findIndex((c) => c.id === contactoId);
        const actualizado: ContactoNotificacion = {
          ...contactos[idx],
          autorizaAvisos: solicitud.autorizaAvisos,
          version: contactos[idx].version + 1,
        };
        contactos[idx] = actualizado;
        return actualizado;
      }),
    };

    const servicioAcademico = {
      listarCursos: vi.fn(async () => [
        {
          id: 'cur-1',
          anioLectivoId: 'anio-1',
          nivel: '8vo EGB',
          paralelo: 'A',
          version: 1,
        },
      ]),
    };

    return { servicioMatriculas, servicioAcademico };
  }

  it('valida E.164, registra matrícula con representante y WhatsApp en ms-notificaciones, y permite revocar consentimiento', async () => {
    const { servicioMatriculas, servicioAcademico } = crearServiciosMock();

    render(
      <PantallaMatricula
        servicioMatriculas={servicioMatriculas}
        servicioAcademico={servicioAcademico}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Registrar matrícula/i }),
      ).toBeInTheDocument();
    });

    // Validación de formato WhatsApp E.164
    fireEvent.change(screen.getByLabelText(/WhatsApp \(formato E\.164\)/i), {
      target: { value: '0999' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar matrícula/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /formato internacional E\.164/i,
    );

    // Completar datos válidos
    fireEvent.change(screen.getByLabelText(/Nombres del estudiante/i), {
      target: { value: 'Mateo Andrés' },
    });
    fireEvent.change(screen.getByLabelText(/Apellidos del estudiante/i), {
      target: { value: 'Salazar Gómez' },
    });
    fireEvent.change(screen.getByLabelText(/Cédula del estudiante/i), {
      target: { value: CEDULA_ESTUDIANTE_SINTETICA },
    });

    fireEvent.change(screen.getByLabelText(/Nombres del representante/i), {
      target: { value: 'María Elena' },
    });
    fireEvent.change(screen.getByLabelText(/Apellidos del representante/i), {
      target: { value: 'Gómez Vera' },
    });
    fireEvent.change(screen.getByLabelText(/Cédula del representante/i), {
      target: { value: CEDULA_REPRESENTANTE_SINTETICA },
    });

    fireEvent.change(screen.getByLabelText(/WhatsApp \(formato E\.164\)/i), {
      target: { value: WHATSAPP_E164_SINTETICO },
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrar matrícula/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Matrícula registrada con representante y autorización de WhatsApp en ms-notificaciones/i,
      );
      const lista = screen.getByTestId('lista-matriculas');
      expect(lista).toHaveTextContent('Salazar Gómez Mateo Andrés');
      expect(lista).toHaveTextContent('8vo EGB "A"');
      expect(lista).toHaveTextContent(WHATSAPP_E164_SINTETICO);
    });

    expect(servicioMatriculas.crearRepresentacion).toHaveBeenCalledTimes(1);
    expect(servicioMatriculas.crearMatricula).toHaveBeenCalledTimes(1);
    expect(servicioMatriculas.crearContacto).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: WHATSAPP_E164_SINTETICO,
        autorizaAvisos: true,
      }),
    );

    // Pestaña de contactos y consentimiento
    fireEvent.click(
      screen.getByRole('button', { name: /Contactos y consentimiento WhatsApp/i }),
    );
    expect(screen.getByTestId('lista-contactos')).toHaveTextContent('Autorizado');

    fireEvent.click(screen.getByRole('button', { name: /Revocar avisos/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Baja de avisos aplicada/i,
      );
      expect(screen.getByTestId('lista-contactos')).toHaveTextContent(
        'Dado de baja',
      );
    });
  });

  it('muestra alerta cuando falla la carga inicial desde la API', async () => {
    const { servicioMatriculas, servicioAcademico } = crearServiciosMock();
    servicioMatriculas.listarEstudiantes.mockRejectedValueOnce(
      new ErrorHttpApi(500, 'ERROR_SERVIDOR', 'No se pudo consultar estudiantes'),
    );

    render(
      <PantallaMatricula
        servicioMatriculas={servicioMatriculas}
        servicioAcademico={servicioAcademico}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo consultar estudiantes',
      );
    });
  });
});
