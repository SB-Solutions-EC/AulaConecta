import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorHttpApi, type ClienteHttp } from '../api/clienteHttp';
import {
  MIME_XLSX,
  ServicioImportacionApi,
  TAMANO_MAXIMO_EXCEL_BYTES,
} from '../api/importacionApi';
import {
  PantallaImportacion,
  type FilaVistaPrevia,
} from './PantallaImportacion';

const CEDULA_SINTETICA = '9900000001';

describe('ServicioImportacionApi', () => {
  it('envía FormData con cursoId y archivo a POST /api/academico/matriculas/importar', async () => {
    const httpMock = {
      post: vi.fn().mockResolvedValue({
        totalFilas: 1,
        importados: 1,
        errores: [],
      }),
    } as unknown as ClienteHttp;

    const api = new ServicioImportacionApi(httpMock);
    const archivo = new File(['contenido'], 'nomina.xlsx', { type: MIME_XLSX });

    await api.importarNomina('cur-1', archivo);

    expect(httpMock.post).toHaveBeenCalledTimes(1);
    const [ruta, cuerpo] = (httpMock.post as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(ruta).toBe('/api/academico/matriculas/importar');
    expect(cuerpo).toBeInstanceOf(FormData);
    expect((cuerpo as FormData).get('cursoId')).toBe('cur-1');
    expect((cuerpo as FormData).get('archivo')).toBe(archivo);
  });
});

describe('PantallaImportacion', () => {
  function crearServiciosMock() {
    const servicioImportacion = {
      importarNomina: vi.fn(async () => ({
        totalFilas: 2,
        importados: 1,
        errores: [{ fila: 3, mensaje: 'La cédula de la fila 3 es inválida.' }],
      })),
    };

    const servicioAcademico = {
      listarCursos: vi.fn(async () => [
        {
          id: 'cur-1',
          anioLectivoId: 'anio-1',
          nivel: '9no EGB',
          paralelo: 'B',
          version: 1,
        },
      ]),
    };

    return { servicioImportacion, servicioAcademico };
  }

  it('valida extensión y tamaño, muestra vista previa y detalla errores por fila tras importar', async () => {
    const { servicioImportacion, servicioAcademico } = crearServiciosMock();
    const previsualizarArchivo = vi.fn(
      async (): Promise<FilaVistaPrevia[]> => [
        {
          fila: 2,
          cedula: CEDULA_SINTETICA,
          nombres: 'Sofía',
          apellidos: 'Navarro',
        },
        {
          fila: 3,
          cedula: '123',
          nombres: 'Luis',
          apellidos: 'Vera',
          advertencia: 'Cédula con formato distinto a 10 dígitos.',
        },
      ],
    );

    render(
      <PantallaImportacion
        servicioImportacion={servicioImportacion}
        servicioAcademico={servicioAcademico}
        previsualizarArchivo={previsualizarArchivo}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Importar nómina/i }),
      ).toBeInTheDocument();
    });

    const inputArchivo = screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i);

    // Rechaza extensión distinta a .xlsx
    fireEvent.change(inputArchivo, {
      target: {
        files: [new File(['a,b'], 'nomina.csv', { type: 'text/csv' })],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Solo se admiten archivos Excel con extensión \.xlsx/i,
    );

    // Rechaza archivo vacío
    fireEvent.change(inputArchivo, {
      target: {
        files: [new File([], 'vacio.xlsx', { type: MIME_XLSX })],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/está vacío/i);

    // Rechaza archivo > 2 MB
    const archivoGrande = new File(['x'], 'grande.xlsx', { type: MIME_XLSX });
    Object.defineProperty(archivoGrande, 'size', {
      value: TAMANO_MAXIMO_EXCEL_BYTES + 1,
    });
    fireEvent.change(inputArchivo, {
      target: { files: [archivoGrande] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /supera el límite máximo permitido de 2 MB/i,
    );

    // Archivo válido con vista previa
    const archivoValido = new File(['PK'], 'nomina-9no.xlsx', {
      type: MIME_XLSX,
    });
    fireEvent.change(inputArchivo, {
      target: { files: [archivoValido] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('info-archivo-seleccionado')).toHaveTextContent(
        'nomina-9no.xlsx',
      );
      expect(screen.getByTestId('tabla-vista-previa')).toHaveTextContent(
        CEDULA_SINTETICA,
      );
      expect(screen.getByTestId('tabla-vista-previa')).toHaveTextContent(
        /Cédula con formato distinto a 10 dígitos/i,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Importar nómina/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Procesamiento completado: 1 de 2 fila\(s\) importadas/i,
      );
      expect(screen.getByTestId('resumen-importacion')).toBeInTheDocument();
      expect(screen.getByTestId('tabla-errores-importacion')).toHaveTextContent(
        'Fila 3',
      );
      expect(screen.getByTestId('tabla-errores-importacion')).toHaveTextContent(
        'La cédula de la fila 3 es inválida.',
      );
    });

    expect(servicioImportacion.importarNomina).toHaveBeenCalledWith(
      'cur-1',
      archivoValido,
    );
  });

  it('muestra error HTTP cuando el servidor rechaza el archivo', async () => {
    const { servicioImportacion, servicioAcademico } = crearServiciosMock();
    servicioImportacion.importarNomina.mockRejectedValueOnce(
      new ErrorHttpApi(400, 'ARCHIVO_CON_FORMULAS', 'El archivo contiene fórmulas.'),
    );

    render(
      <PantallaImportacion
        servicioImportacion={servicioImportacion}
        servicioAcademico={servicioAcademico}
        previsualizarArchivo={async () => []}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Importar nómina/i }),
      ).toBeInTheDocument();
    });

    const inputArchivo = screen.getByLabelText(/Archivo Excel \(\.xlsx\)/i);
    fireEvent.change(inputArchivo, {
      target: {
        files: [new File(['PK'], 'formulas.xlsx', { type: MIME_XLSX })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('info-archivo-seleccionado')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Importar nómina/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El archivo contiene fórmulas.',
      );
    });
  });
});
