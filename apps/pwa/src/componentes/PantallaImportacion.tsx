import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type Curso,
  type ServicioAcademicoConfigApi,
} from '../api/academicoConfigApi';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  MAX_FILAS_EXCEL,
  servicioImportacionApi,
  TAMANO_MAXIMO_EXCEL_BYTES,
  type ResultadoImportacionExcel,
  type ServicioImportacionApi,
} from '../api/importacionApi';

export interface FilaVistaPrevia {
  fila: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  advertencia?: string;
}

export interface PropiedadesPantallaImportacion {
  servicioImportacion?: Pick<ServicioImportacionApi, 'importarNomina'>;
  servicioAcademico?: Pick<ServicioAcademicoConfigApi, 'listarCursos'>;
  previsualizarArchivo?: (archivo: File) => Promise<FilaVistaPrevia[]>;
}

const PATRON_CEDULA_10 = /^\d{10}$/;

function extraerMensajeError(error: unknown, respaldo: string): string {
  if (error instanceof ErrorHttpApi) {
    return error.message || `${respaldo} (${error.codigo})`;
  }
  return respaldo;
}

function formatearTamanoKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function validarArchivoSeleccionado(archivo: File): string | null {
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    return 'Solo se admiten archivos Excel con extensión .xlsx.';
  }
  if (archivo.size === 0) {
    return 'El archivo seleccionado está vacío.';
  }
  if (archivo.size > TAMANO_MAXIMO_EXCEL_BYTES) {
    return 'El archivo supera el límite máximo permitido de 2 MB.';
  }
  return null;
}

async function descomprimirEntradaZip(
  metodo: number,
  datos: Uint8Array,
): Promise<string | null> {
  if (metodo === 0) {
    return new TextDecoder().decode(datos);
  }
  if (metodo === 8 && typeof DecompressionStream !== 'undefined') {
    const flujo = new Blob([new Uint8Array(datos)])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flujo).text();
  }
  return null;
}

async function leerEntradasXmlXlsx(
  buffer: ArrayBuffer,
): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  const bytes = new Uint8Array(buffer);
  const vista = new DataView(buffer);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    if (vista.getUint32(offset, true) !== 0x04034b50) {
      break;
    }
    const metodo = vista.getUint16(offset + 8, true);
    const tamanoComprimido = vista.getUint32(offset + 18, true);
    const longNombre = vista.getUint16(offset + 26, true);
    const longExtra = vista.getUint16(offset + 28, true);
    const inicioDatos = offset + 30 + longNombre + longExtra;
    const finDatos = inicioDatos + tamanoComprimido;
    if (finDatos > bytes.length) {
      break;
    }

    const nombre = new TextDecoder().decode(
      bytes.slice(offset + 30, offset + 30 + longNombre),
    );
    if (
      nombre === 'xl/sharedStrings.xml' ||
      nombre === 'xl/worksheets/sheet1.xml'
    ) {
      const texto = await descomprimirEntradaZip(
        metodo,
        bytes.slice(inicioDatos, finDatos),
      );
      if (texto !== null) {
        resultado.set(nombre, texto);
      }
    }
    offset = finDatos;
  }

  return resultado;
}

function parsearSharedStrings(xml: string | undefined): string[] {
  if (!xml || typeof DOMParser === 'undefined') {
    return [];
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const nodos = Array.from(doc.getElementsByTagName('si'));
  return nodos.map((nodo) => nodo.textContent ?? '');
}

function obtenerTextoCelda(celda: Element, sharedStrings: string[]): string {
  const tipo = celda.getAttribute('t');
  if (tipo === 'inlineStr') {
    return (celda.textContent ?? '').trim();
  }
  const valor = celda.getElementsByTagName('v')[0]?.textContent?.trim() ?? '';
  if (tipo === 's') {
    const indice = Number.parseInt(valor, 10);
    return Number.isNaN(indice) ? '' : (sharedStrings[indice] ?? '').trim();
  }
  return valor;
}

function construirAdvertenciaFila(
  cedula: string,
  nombres: string,
  apellidos: string,
): string | undefined {
  if (!cedula || !nombres || !apellidos) {
    return 'Faltan columnas obligatorias (cédula, nombres o apellidos).';
  }
  if (!PATRON_CEDULA_10.test(cedula)) {
    return 'Cédula con formato distinto a 10 dígitos.';
  }
  return undefined;
}

export async function previsualizarXlsxPorDefecto(
  archivo: File,
): Promise<FilaVistaPrevia[]> {
  try {
    if (typeof archivo.arrayBuffer !== 'function') {
      return [];
    }
    const buffer = await archivo.arrayBuffer();
    const entradas = await leerEntradasXmlXlsx(buffer);
    const sheetXml = entradas.get('xl/worksheets/sheet1.xml');
    if (!sheetXml || typeof DOMParser === 'undefined') {
      return [];
    }

    const sharedStrings = parsearSharedStrings(
      entradas.get('xl/sharedStrings.xml'),
    );
    const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
    const filas = Array.from(doc.getElementsByTagName('row')).slice(
      1,
      MAX_FILAS_EXCEL + 1,
    );

    return filas.map((filaEl, idx) => {
      const celdas = Array.from(filaEl.getElementsByTagName('c'));
      const cedula = celdas[0] ? obtenerTextoCelda(celdas[0], sharedStrings) : '';
      const nombres = celdas[1] ? obtenerTextoCelda(celdas[1], sharedStrings) : '';
      const apellidos = celdas[2]
        ? obtenerTextoCelda(celdas[2], sharedStrings)
        : '';
      const numeroFila = Number.parseInt(filaEl.getAttribute('r') ?? '', 10);
      return {
        fila: Number.isNaN(numeroFila) ? idx + 2 : numeroFila,
        cedula,
        nombres,
        apellidos,
        advertencia: construirAdvertenciaFila(cedula, nombres, apellidos),
      };
    });
  } catch {
    return [];
  }
}

export function PantallaImportacion({
  servicioImportacion = servicioImportacionApi,
  servicioAcademico = servicioAcademicoConfigApi,
  previsualizarArchivo = previsualizarXlsxPorDefecto,
}: Readonly<PropiedadesPantallaImportacion>) {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<FilaVistaPrevia[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacionExcel | null>(
    null,
  );

  const [cargandoCursos, setCargandoCursos] = useState(true);
  const [importando, setImportando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const cargarCursos = useCallback(async () => {
    setCargandoCursos(true);
    setErrorGlobal(null);
    try {
      const lista = await servicioAcademico.listarCursos();
      setCursos(lista);
      if (lista.length > 0) {
        setCursoSeleccionadoId((actual) => actual || lista[0].id);
      }
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(
          error,
          'No se pudieron cargar los cursos para la importación.',
        ),
      );
    } finally {
      setCargandoCursos(false);
    }
  }, [servicioAcademico]);

  useEffect(() => {
    cargarCursos().catch(() => undefined);
  }, [cargarCursos]);

  const manejarSeleccionArchivo = async (
    evento: ChangeEvent<HTMLInputElement>,
  ) => {
    setErrorGlobal(null);
    setMensajeExito(null);
    setResultado(null);
    setVistaPrevia([]);

    const seleccionado = evento.target.files?.[0] ?? null;
    if (!seleccionado) {
      setArchivo(null);
      return;
    }

    const errorValidacion = validarArchivoSeleccionado(seleccionado);
    if (errorValidacion) {
      setArchivo(null);
      setErrorGlobal(errorValidacion);
      return;
    }

    setArchivo(seleccionado);
    const filas = await previsualizarArchivo(seleccionado);
    setVistaPrevia(filas.slice(0, 50));
  };

  const manejarImportar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGlobal(null);
    setMensajeExito(null);

    if (!cursoSeleccionadoId) {
      setErrorGlobal('Selecciona un curso de destino antes de importar.');
      return;
    }

    if (!archivo) {
      setErrorGlobal('Selecciona un archivo Excel (.xlsx) válido para importar.');
      return;
    }

    setImportando(true);
    try {
      const respuesta = await servicioImportacion.importarNomina(
        cursoSeleccionadoId,
        archivo,
      );
      setResultado(respuesta);
      setMensajeExito(
        `Procesamiento completado: ${respuesta.importados} de ${respuesta.totalFilas} fila(s) importadas.`,
      );
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(
          error,
          'No se pudo procesar la importación de la nómina.',
        ),
      );
    } finally {
      setImportando(false);
    }
  };

  return (
    <section
      data-testid="pantalla-importacion"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Importación de nóminas · RF-04
          </span>
          <h2 className="text-2xl font-bold text-slate-900">
            Importación de Nóminas desde Excel (.xlsx)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Carga nóminas de estudiantes en formato .xlsx (máximo 2 MB y 1000 filas), revisa la vista previa y consulta el detalle de errores por fila.
          </p>
        </div>
      </header>

      {errorGlobal ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorGlobal}</span>
        </div>
      ) : null}

      {mensajeExito ? (
        <output className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          <span>{mensajeExito}</span>
        </output>
      ) : null}

      {cargandoCursos ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          Cargando cursos disponibles...
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={manejarImportar}
            className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Cargar archivo de nómina
            </h3>

            <div>
              <label
                htmlFor="importacion-curso"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Curso de destino
              </label>
              <select
                id="importacion-curso"
                value={cursoSeleccionadoId}
                onChange={(e) => setCursoSeleccionadoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona un curso</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nivel} "{curso.paralelo}"
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="importacion-archivo"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Archivo Excel (.xlsx)
              </label>
              <input
                id="importacion-archivo"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  manejarSeleccionArchivo(e).catch(() => undefined);
                }}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Límites del servidor: extensión .xlsx, hasta 2 MB, sin macros ni fórmulas.
              </p>
            </div>

            {archivo ? (
              <div
                data-testid="info-archivo-seleccionado"
                className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 space-y-1"
              >
                <p>
                  <strong>Archivo:</strong> {archivo.name}
                </p>
                <p>
                  <strong>Tamaño:</strong> {formatearTamanoKb(archivo.size)}
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={importando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Upload className="w-4 h-4" />
              {importando ? 'Importando...' : 'Importar nómina'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Vista previa de filas
              </h3>
              {vistaPrevia.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {archivo
                    ? 'Archivo listo para validación completa en el servidor (sin filas legibles en vista previa local).'
                    : 'Selecciona un archivo .xlsx para visualizar la vista previa previa al envío.'}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table
                    data-testid="tabla-vista-previa"
                    className="min-w-full divide-y divide-slate-200 text-xs"
                  >
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Fila</th>
                        <th className="px-3 py-2 text-left font-semibold">Cédula</th>
                        <th className="px-3 py-2 text-left font-semibold">Nombres</th>
                        <th className="px-3 py-2 text-left font-semibold">Apellidos</th>
                        <th className="px-3 py-2 text-left font-semibold">Validación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {vistaPrevia.map((fila) => (
                        <tr key={fila.fila}>
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {fila.fila}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{fila.cedula}</td>
                          <td className="px-3 py-2 text-slate-700">{fila.nombres}</td>
                          <td className="px-3 py-2 text-slate-700">{fila.apellidos}</td>
                          <td className="px-3 py-2">
                            {fila.advertencia ? (
                              <span className="text-amber-700 font-medium">
                                {fila.advertencia}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {resultado ? (
              <div className="space-y-4" data-testid="resumen-importacion">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center">
                    <p className="text-xs text-slate-500">Total filas</p>
                    <p className="text-xl font-bold text-slate-900">
                      {resultado.totalFilas}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-center">
                    <p className="text-xs text-emerald-700">Importados</p>
                    <p className="text-xl font-bold text-emerald-800">
                      {resultado.importados}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-center">
                    <p className="text-xs text-rose-700">Errores</p>
                    <p className="text-xl font-bold text-rose-800">
                      {resultado.errores.length}
                    </p>
                  </div>
                </div>

                {resultado.errores.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-rose-200">
                    <table
                      data-testid="tabla-errores-importacion"
                      className="min-w-full divide-y divide-rose-200 text-xs"
                    >
                      <thead className="bg-rose-50 text-rose-800">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Fila</th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Detalle del error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 bg-white">
                        {resultado.errores.map((item) => (
                          <tr key={`${item.fila}-${item.mensaje}`}>
                            <td className="px-3 py-2 font-semibold text-rose-800">
                              Fila {item.fila}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {item.mensaje}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
