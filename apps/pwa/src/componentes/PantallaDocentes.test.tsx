import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorHttpApi, type ClienteHttp } from '../api/clienteHttp';
import {
  ServicioDocentesApi,
  type AsignacionDocente,
  type DocentePersona,
} from '../api/docentesApi';
import { PantallaDocentes } from './PantallaDocentes';

const CEDULA_SINTETICA_UNO = '9900000001';

describe('ServicioDocentesApi', () => {
  it('construye rutas y cuerpos de petición según el contrato OpenAPI', async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
    } as unknown as ClienteHttp;

    const api = new ServicioDocentesApi(httpMock);

    await api.listarDocentes();
    expect(httpMock.get).toHaveBeenCalledWith('/api/academico/personas?tipo=DOCENTE');

    await api.listarDocentes('Paredes');
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/academico/personas?tipo=DOCENTE&q=Paredes',
    );

    await api.crearDocente({
      nombres: 'Ana Lucía',
      apellidos: 'Paredes',
      cedula: CEDULA_SINTETICA_UNO,
      area: 'Matemáticas',
    });
    expect(httpMock.post).toHaveBeenCalledWith('/api/academico/personas', {
      nombres: 'Ana Lucía',
      apellidos: 'Paredes',
      cedula: CEDULA_SINTETICA_UNO,
      area: 'Matemáticas',
      tipo: 'DOCENTE',
    });

    await api.listarAsignaciones();
    expect(httpMock.get).toHaveBeenCalledWith('/api/academico/asignaciones');

    await api.listarAsignaciones({ docenteId: 'doc-1', cursoId: 'cur-1' });
    expect(httpMock.get).toHaveBeenCalledWith(
      '/api/academico/asignaciones?docenteId=doc-1&cursoId=cur-1',
    );

    await api.crearAsignacion({
      docenteId: 'doc-1',
      cursoId: 'cur-1',
      materiaId: 'mat-1',
      horarios: [{ dia: 1, hora: 'h1' }],
    });
    expect(httpMock.post).toHaveBeenCalledWith('/api/academico/asignaciones', {
      docenteId: 'doc-1',
      cursoId: 'cur-1',
      materiaId: 'mat-1',
      horarios: [{ dia: 1, hora: 'h1' }],
    });
  });
});

describe('PantallaDocentes', () => {
  function crearServiciosMock(inicial?: {
    docentes?: DocentePersona[];
    asignaciones?: AsignacionDocente[];
  }) {
    const docentes: DocentePersona[] = inicial?.docentes
      ? [...inicial.docentes]
      : [
          {
            id: 'doc-1',
            usuarioId: 'usr-1',
            tipo: 'DOCENTE',
            nombres: 'Carlos Andrés',
            apellidos: 'Mendoza Ruiz',
            area: 'Física',
            version: 1,
          },
        ];

    const asignaciones: AsignacionDocente[] = inicial?.asignaciones
      ? [...inicial.asignaciones]
      : [];

    const servicioDocentes = {
      listarDocentes: vi.fn(async (busqueda?: string) => {
        if (!busqueda?.trim()) {
          return [...docentes];
        }
        const texto = busqueda.trim().toLowerCase();
        return docentes.filter(
          (item) =>
            item.nombres.toLowerCase().includes(texto) ||
            item.apellidos.toLowerCase().includes(texto) ||
            (item.area ?? '').toLowerCase().includes(texto),
        );
      }),
      crearDocente: vi.fn(async (solicitud) => {
        const nuevo: DocentePersona = {
          id: `doc-${docentes.length + 1}`,
          usuarioId: `usr-${docentes.length + 1}`,
          tipo: 'DOCENTE',
          nombres: solicitud.nombres,
          apellidos: solicitud.apellidos,
          area: solicitud.area ?? null,
          version: 1,
        };
        docentes.push(nuevo);
        return nuevo;
      }),
      listarAsignaciones: vi.fn(async () => [...asignaciones]),
      crearAsignacion: vi.fn(async (solicitud) => {
        const nueva: AsignacionDocente = {
          id: `asig-${asignaciones.length + 1}`,
          docenteId: solicitud.docenteId,
          cursoId: solicitud.cursoId,
          materiaId: solicitud.materiaId,
          horarios: solicitud.horarios,
          version: 1,
        };
        asignaciones.push(nueva);
        return nueva;
      }),
    };

    const servicioAcademico = {
      listarCursos: vi.fn(async () => [
        {
          id: 'cur-1',
          anioLectivoId: 'anio-1',
          nivel: '1ro BGU',
          paralelo: 'A',
          version: 1,
        },
      ]),
      listarMaterias: vi.fn(async () => [
        {
          id: 'mat-1',
          nombre: 'Matemáticas',
          area: 'Ciencias Exactas',
          version: 1,
        },
      ]),
    };

    return { servicioDocentes, servicioAcademico };
  }

  it('valida formulario, registra un docente nuevo y permite buscarlo', async () => {
    const { servicioDocentes, servicioAcademico } = crearServiciosMock();

    render(
      <PantallaDocentes
        servicioDocentes={servicioDocentes}
        servicioAcademico={servicioAcademico}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Mendoza Ruiz Carlos Andrés')).toBeInTheDocument();
    });

    // Validación de campos vacíos
    fireEvent.click(screen.getByRole('button', { name: /Registrar docente/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Completa nombres, apellidos y cédula del docente/i,
    );

    // Validación de cédula de 10 dígitos
    fireEvent.change(screen.getByLabelText(/^Nombres$/i), {
      target: { value: 'Ana Lucía' },
    });
    fireEvent.change(screen.getByLabelText(/^Apellidos$/i), {
      target: { value: 'Paredes Vega' },
    });
    fireEvent.change(screen.getByLabelText(/^Cédula$/i), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar docente/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /La cédula debe tener exactamente 10 dígitos numéricos/i,
    );

    // Registro válido
    fireEvent.change(screen.getByLabelText(/^Cédula$/i), {
      target: { value: CEDULA_SINTETICA_UNO },
    });
    fireEvent.change(screen.getByLabelText(/Área académica/i), {
      target: { value: 'Matemáticas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar docente/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Paredes Vega Ana Lucía.*registrado correctamente/i,
      );
      expect(screen.getByText('Paredes Vega Ana Lucía')).toBeInTheDocument();
    });

    // Búsqueda de docentes
    fireEvent.change(screen.getByLabelText(/Buscar docente/i), {
      target: { value: 'Paredes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Buscar$/i }));

    await waitFor(() => {
      expect(servicioDocentes.listarDocentes).toHaveBeenCalledWith('Paredes');
    });
  });

  it('permite asignar materias con bloques horarios y valida bloques duplicados', async () => {
    const { servicioDocentes, servicioAcademico } = crearServiciosMock();

    render(
      <PantallaDocentes
        servicioDocentes={servicioDocentes}
        servicioAcademico={servicioAcademico}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Mendoza Ruiz Carlos Andrés')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Asignación de materias/i }));

    // Agregar bloque horario
    fireEvent.click(screen.getByRole('button', { name: /Agregar bloque horario/i }));
    expect(screen.getByText('Lun h1')).toBeInTheDocument();

    // Intentar duplicar el mismo bloque
    fireEvent.click(screen.getByRole('button', { name: /Agregar bloque horario/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /El bloque Lun h1 ya está agregado/i,
    );

    // Quitar y volver a agregar otro bloque
    fireEvent.click(screen.getByRole('button', { name: /Quitar bloque Lun h1/i }));
    expect(screen.queryByText('Lun h1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Día del bloque/i), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText(/Hora del bloque/i), {
      target: { value: 'h2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Agregar bloque horario/i }));

    fireEvent.click(screen.getByRole('button', { name: /Asignar materia/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Asignación de materia registrada correctamente/i,
      );
      const listaAsignaciones = screen.getByTestId('lista-asignaciones');
      expect(listaAsignaciones).toHaveTextContent('Matemáticas · 1ro BGU "A"');
      expect(listaAsignaciones).toHaveTextContent('Mié h2');
    });
  });

  it('muestra errores de API al fallar la carga inicial o el registro', async () => {
    const { servicioDocentes, servicioAcademico } = crearServiciosMock();
    servicioDocentes.listarDocentes.mockRejectedValueOnce(
      new ErrorHttpApi(500, 'ERROR_SERVIDOR', 'Fallo al consultar docentes'),
    );

    render(
      <PantallaDocentes
        servicioDocentes={servicioDocentes}
        servicioAcademico={servicioAcademico}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Fallo al consultar docentes',
      );
    });
  });
});
