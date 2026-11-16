import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type Curso,
  type Materia,
  type ServicioAcademicoConfigApi,
} from '../api/academicoConfigApi';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  servicioDocentesApi,
  type AsignacionDocente,
  type BloqueHorario,
  type DocentePersona,
  type HoraBloque,
  type ServicioDocentesApi,
} from '../api/docentesApi';

export type PestanaDocentes = 'docentes' | 'asignaciones';

export interface PropiedadesPantallaDocentes {
  servicioDocentes?: Pick<
    ServicioDocentesApi,
    'listarDocentes' | 'crearDocente' | 'listarAsignaciones' | 'crearAsignacion'
  >;
  servicioAcademico?: Pick<
    ServicioAcademicoConfigApi,
    'listarCursos' | 'listarMaterias'
  >;
}

const DIAS_SEMANA: ReadonlyArray<{ valor: number; etiqueta: string; corto: string }> = [
  { valor: 1, etiqueta: 'Lunes', corto: 'Lun' },
  { valor: 2, etiqueta: 'Martes', corto: 'Mar' },
  { valor: 3, etiqueta: 'Miércoles', corto: 'Mié' },
  { valor: 4, etiqueta: 'Jueves', corto: 'Jue' },
  { valor: 5, etiqueta: 'Viernes', corto: 'Vie' },
];

const HORAS_BLOQUE: ReadonlyArray<{ valor: HoraBloque; etiqueta: string }> = [
  { valor: 'h1', etiqueta: '1.ª hora (h1)' },
  { valor: 'h2', etiqueta: '2.ª hora (h2)' },
  { valor: 'h3', etiqueta: '3.ª hora (h3)' },
  { valor: 'h4', etiqueta: '4.ª hora (h4)' },
  { valor: 'h5', etiqueta: '5.ª hora (h5)' },
];

function extraerMensajeError(error: unknown, respaldo: string): string {
  if (error instanceof ErrorHttpApi) {
    return error.message || `${respaldo} (${error.codigo})`;
  }
  return respaldo;
}

function etiquetaDia(dia: number): string {
  return DIAS_SEMANA.find((item) => item.valor === dia)?.corto ?? `Día ${dia}`;
}

export function PantallaDocentes({
  servicioDocentes = servicioDocentesApi,
  servicioAcademico = servicioAcademicoConfigApi,
}: Readonly<PropiedadesPantallaDocentes>) {
  const [pestana, setPestana] = useState<PestanaDocentes>('docentes');

  const [docentes, setDocentes] = useState<DocentePersona[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionDocente[]>([]);

  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cedula, setCedula] = useState('');
  const [area, setArea] = useState('');
  const [guardandoDocente, setGuardandoDocente] = useState(false);

  const [docenteSeleccionadoId, setDocenteSeleccionadoId] = useState('');
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState('');
  const [materiaSeleccionadaId, setMateriaSeleccionadaId] = useState('');
  const [diaBloque, setDiaBloque] = useState<number>(1);
  const [horaBloque, setHoraBloque] = useState<HoraBloque>('h1');
  const [horarios, setHorarios] = useState<BloqueHorario[]>([]);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  const cargarDatos = useCallback(
    async (filtroBusqueda?: string) => {
      setCargando(true);
      setErrorGlobal(null);
      try {
        const [listaDocentes, listaCursos, listaMaterias, listaAsignaciones] =
          await Promise.all([
            servicioDocentes.listarDocentes(filtroBusqueda),
            servicioAcademico.listarCursos(),
            servicioAcademico.listarMaterias(),
            servicioDocentes.listarAsignaciones(),
          ]);

        setDocentes(listaDocentes);
        setCursos(listaCursos);
        setMaterias(listaMaterias);
        setAsignaciones(listaAsignaciones);

        if (listaDocentes.length > 0) {
          setDocenteSeleccionadoId((actual) => actual || listaDocentes[0].id);
        }
        if (listaCursos.length > 0) {
          setCursoSeleccionadoId((actual) => actual || listaCursos[0].id);
        }
        if (listaMaterias.length > 0) {
          setMateriaSeleccionadaId((actual) => actual || listaMaterias[0].id);
        }
      } catch (error) {
        setErrorGlobal(
          extraerMensajeError(
            error,
            'No se pudo cargar el módulo de docentes y asignaciones.',
          ),
        );
      } finally {
        setCargando(false);
      }
    },
    [servicioDocentes, servicioAcademico],
  );

  useEffect(() => {
    cargarDatos().catch(() => undefined);
  }, [cargarDatos]);

  const manejarBuscar = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensajeExito(null);
    setErrorGlobal(null);
    try {
      const lista = await servicioDocentes.listarDocentes(busqueda);
      setDocentes(lista);
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(error, 'No se pudo filtrar la lista de docentes.'),
      );
    }
  };

  const manejarCrearDocente = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensajeExito(null);
    setErrorGlobal(null);

    const nombresLimpios = nombres.trim();
    const apellidosLimpios = apellidos.trim();
    const cedulaLimpia = cedula.trim();
    const areaLimpia = area.trim();

    if (!nombresLimpios || !apellidosLimpios || !cedulaLimpia) {
      setErrorGlobal('Completa nombres, apellidos y cédula del docente.');
      return;
    }

    if (!/^\d{10}$/.test(cedulaLimpia)) {
      setErrorGlobal('La cédula debe tener exactamente 10 dígitos numéricos.');
      return;
    }

    setGuardandoDocente(true);
    try {
      const creado = await servicioDocentes.crearDocente({
        nombres: nombresLimpios,
        apellidos: apellidosLimpios,
        cedula: cedulaLimpia,
        area: areaLimpia || undefined,
      });

      setNombres('');
      setApellidos('');
      setCedula('');
      setArea('');
      setDocenteSeleccionadoId(creado.id);
      setMensajeExito(
        `Docente "${creado.apellidos} ${creado.nombres}" registrado correctamente.`,
      );
      await cargarDatos(busqueda);
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(error, 'No se pudo registrar al docente.'),
      );
    } finally {
      setGuardandoDocente(false);
    }
  };

  const agregarBloqueHorario = () => {
    setErrorGlobal(null);
    const existe = horarios.some(
      (bloque) => bloque.dia === diaBloque && bloque.hora === horaBloque,
    );
    if (existe) {
      setErrorGlobal(
        `El bloque ${etiquetaDia(diaBloque)} ${horaBloque} ya está agregado.`,
      );
      return;
    }
    setHorarios((prev) => [...prev, { dia: diaBloque, hora: horaBloque }]);
  };

  const quitarBloqueHorario = (indice: number) => {
    setHorarios((prev) => prev.filter((_, idx) => idx !== indice));
  };

  const manejarCrearAsignacion = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensajeExito(null);
    setErrorGlobal(null);

    if (!docenteSeleccionadoId || !cursoSeleccionadoId || !materiaSeleccionadaId) {
      setErrorGlobal('Selecciona docente, curso y materia para asignar.');
      return;
    }

    setGuardandoAsignacion(true);
    try {
      await servicioDocentes.crearAsignacion({
        docenteId: docenteSeleccionadoId,
        cursoId: cursoSeleccionadoId,
        materiaId: materiaSeleccionadaId,
        horarios: horarios.length > 0 ? horarios : undefined,
      });

      setHorarios([]);
      setMensajeExito('Asignación de materia registrada correctamente.');
      const lista = await servicioDocentes.listarAsignaciones();
      setAsignaciones(lista);
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(error, 'No se pudo registrar la asignación.'),
      );
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const obtenerNombreDocente = (docenteId: string): string => {
    const docente = docentes.find((item) => item.id === docenteId);
    return docente ? `${docente.apellidos} ${docente.nombres}` : docenteId;
  };

  const obtenerNombreCurso = (cursoId: string): string => {
    const curso = cursos.find((item) => item.id === cursoId);
    return curso ? `${curso.nivel} "${curso.paralelo}"` : cursoId;
  };

  const obtenerNombreMateria = (materiaId: string): string => {
    const materia = materias.find((item) => item.id === materiaId);
    return materia ? materia.nombre : materiaId;
  };

  return (
    <section
      data-testid="pantalla-docentes"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Gestión docente · RF-05
          </span>
          <h2 className="text-2xl font-bold text-slate-900">
            Personal Docente y Asignación de Materias
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Registra docentes, consulta su nómina y asigna materias, cursos y bloques horarios.
          </p>
        </div>
      </header>

      <nav aria-label="Secciones de gestión docente" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPestana('docentes');
            setErrorGlobal(null);
            setMensajeExito(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            pestana === 'docentes'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Docentes
        </button>

        <button
          type="button"
          onClick={() => {
            setPestana('asignaciones');
            setErrorGlobal(null);
            setMensajeExito(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            pestana === 'asignaciones'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Asignación de materias
        </button>
      </nav>

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

      {cargando ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          Cargando información docente...
        </p>
      ) : null}

      {!cargando && pestana === 'docentes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={manejarCrearDocente}
            className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              Registrar docente
            </h3>

            <div>
              <label
                htmlFor="docente-nombres"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombres
              </label>
              <input
                id="docente-nombres"
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Ej. Ana Lucía"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="docente-apellidos"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Apellidos
              </label>
              <input
                id="docente-apellidos"
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ej. Paredes Vega"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="docente-cedula"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Cédula
              </label>
              <input
                id="docente-cedula"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="9900000001"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="docente-area"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Área académica (opcional)
              </label>
              <input
                id="docente-area"
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej. Matemáticas"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={guardandoDocente}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              {guardandoDocente ? 'Registrando...' : 'Registrar docente'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <form onSubmit={manejarBuscar} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="search"
                  aria-label="Buscar docente"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombres, apellidos o área..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Buscar
              </button>
            </form>

            {docentes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No hay docentes registrados con los criterios actuales.
              </div>
            ) : (
              <ul className="space-y-3" data-testid="lista-docentes">
                {docentes.map((docente) => (
                  <li
                    key={docente.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {docente.apellidos} {docente.nombres}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Área: {docente.area || 'Sin área asignada'}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 w-fit">
                      DOCENTE
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {!cargando && pestana === 'asignaciones' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={manejarCrearAsignacion}
            className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-600" />
              Nueva asignación
            </h3>

            <div>
              <label
                htmlFor="asignacion-docente"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Docente
              </label>
              <select
                id="asignacion-docente"
                value={docenteSeleccionadoId}
                onChange={(e) => setDocenteSeleccionadoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona un docente</option>
                {docentes.map((docente) => (
                  <option key={docente.id} value={docente.id}>
                    {docente.apellidos} {docente.nombres}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="asignacion-curso"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Curso y paralelo
              </label>
              <select
                id="asignacion-curso"
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
                htmlFor="asignacion-materia"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Materia
              </label>
              <select
                id="asignacion-materia"
                value={materiaSeleccionadaId}
                onChange={(e) => setMateriaSeleccionadaId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona una materia</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre} ({materia.area})
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <p className="text-xs font-semibold text-slate-700">
                Bloques horarios (opcional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Día del bloque"
                  value={diaBloque}
                  onChange={(e) => setDiaBloque(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia.valor} value={dia.valor}>
                      {dia.etiqueta}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Hora del bloque"
                  value={horaBloque}
                  onChange={(e) => setHoraBloque(e.target.value as HoraBloque)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {HORAS_BLOQUE.map((hora) => (
                    <option key={hora.valor} value={hora.valor}>
                      {hora.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={agregarBloqueHorario}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors"
              >
                Agregar bloque horario
              </button>

              {horarios.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {horarios.map((bloque, idx) => (
                    <li
                      key={`${bloque.dia}-${bloque.hora}`}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
                    >
                      <span>
                        {etiquetaDia(bloque.dia)} {bloque.hora}
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar bloque ${etiquetaDia(bloque.dia)} ${bloque.hora}`}
                        onClick={() => quitarBloqueHorario(idx)}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={guardandoAsignacion}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              {guardandoAsignacion ? 'Guardando...' : 'Asignar materia'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Asignaciones registradas
            </h3>

            {asignaciones.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Aún no existen asignaciones de materias registradas.
              </div>
            ) : (
              <ul className="space-y-3" data-testid="lista-asignaciones">
                {asignaciones.map((asignacion) => (
                  <li
                    key={asignacion.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-bold text-slate-900">
                        {obtenerNombreMateria(asignacion.materiaId)} ·{' '}
                        {obtenerNombreCurso(asignacion.cursoId)}
                      </p>
                      <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full w-fit">
                        {obtenerNombreDocente(asignacion.docenteId)}
                      </span>
                    </div>

                    {asignacion.horarios && asignacion.horarios.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {asignacion.horarios.map((bloque, idx) => (
                          <span
                            key={`${asignacion.id}-${bloque.dia}-${bloque.hora}-${idx}`}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          >
                            {etiquetaDia(bloque.dia)} {bloque.hora}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Sin bloques horarios asignados</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
