import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Layers,
  Plus,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type AnioLectivo,
  type Curso,
  type DiaNoDictado,
  type Materia,
  type ServicioAcademicoConfigApi,
} from '../api/academicoConfigApi';
import { ErrorHttpApi } from '../api/clienteHttp';

export type PestanaConfiguracionAcademica =
  | 'anios-lectivos'
  | 'cursos'
  | 'materias';

export interface PropiedadesPantallaConfiguracionAcademica {
  servicio?: Pick<
    ServicioAcademicoConfigApi,
    | 'listarAniosLectivos'
    | 'crearAnioLectivo'
    | 'listarDiasNoDictados'
    | 'crearDiaNoDictado'
    | 'listarCursos'
    | 'crearCurso'
    | 'listarMaterias'
    | 'crearMateria'
  >;
}

function extraerMensajeError(error: unknown, respaldo: string): string {
  if (error instanceof ErrorHttpApi) {
    return error.message || `${respaldo} (${error.codigo})`;
  }
  return respaldo;
}

export function PantallaConfiguracionAcademica({
  servicio = servicioAcademicoConfigApi,
}: Readonly<PropiedadesPantallaConfiguracionAcademica> = {}) {
  const [pestanaActiva, setPestanaActiva] =
    useState<PestanaConfiguracionAcademica>('anios-lectivos');

  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [anioSeleccionadoId, setAnioSeleccionadoId] = useState<string>('');
  const [diasNoDictados, setDiasNoDictados] = useState<DiaNoDictado[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);

  const [cargando, setCargando] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Formulario: Año lectivo
  const [nombreAnio, setNombreAnio] = useState<string>('');
  const [inicioAnio, setInicioAnio] = useState<string>('');
  const [finAnio, setFinAnio] = useState<string>('');
  const [anioActivoFlag, setAnioActivoFlag] = useState<boolean>(true);

  // Formulario: Día no dictado
  const [fechaFeriado, setFechaFeriado] = useState<string>('');
  const [motivoFeriado, setMotivoFeriado] = useState<string>('');

  // Formulario: Curso y paralelo
  const [nivelCurso, setNivelCurso] = useState<string>('');
  const [paraleloCurso, setParaleloCurso] = useState<string>('');

  // Formulario: Materia
  const [nombreMateria, setNombreMateria] = useState<string>('');
  const [areaMateria, setAreaMateria] = useState<string>('');

  const cargarDatosPorAnio = useCallback(
    async (idAnio: string) => {
      if (!idAnio) {
        setDiasNoDictados([]);
        setCursos([]);
        return;
      }
      const [dias, listaCursos] = await Promise.all([
        servicio.listarDiasNoDictados(idAnio),
        servicio.listarCursos(idAnio),
      ]);
      setDiasNoDictados(dias);
      setCursos(listaCursos);
    },
    [servicio],
  );

  const cargarConfiguracionInicial = useCallback(async () => {
    setCargando(true);
    setMensajeError(null);
    try {
      const [listaAnios, listaMaterias] = await Promise.all([
        servicio.listarAniosLectivos(),
        servicio.listarMaterias(),
      ]);
      setAniosLectivos(listaAnios);
      setMaterias(listaMaterias);

      const anioPreferido =
        listaAnios.find((a) => a.activo) ?? listaAnios[0] ?? null;
      const idInicial = anioPreferido ? anioPreferido.id : '';
      setAnioSeleccionadoId(idInicial);
      await cargarDatosPorAnio(idInicial);
    } catch (error) {
      setMensajeError(
        extraerMensajeError(
          error,
          'No se pudo cargar la configuración académica desde ms-academico.',
        ),
      );
    } finally {
      setCargando(false);
    }
  }, [cargarDatosPorAnio, servicio]);

  useEffect(() => {
    cargarConfiguracionInicial().catch(() => undefined);
  }, [cargarConfiguracionInicial]);

  const manejarCambioAnioSeleccionado = async (nuevoId: string) => {
    setAnioSeleccionadoId(nuevoId);
    setMensajeError(null);
    try {
      await cargarDatosPorAnio(nuevoId);
    } catch (error) {
      setMensajeError(
        extraerMensajeError(
          error,
          'No se pudieron cargar los datos del año lectivo seleccionado.',
        ),
      );
    }
  };

  const manejarCrearAnioLectivo = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExito(null);

    if (!nombreAnio.trim() || !inicioAnio || !finAnio) {
      setMensajeError(
        'Complete el nombre y las fechas de inicio y fin del año lectivo.',
      );
      return;
    }
    if (finAnio <= inicioAnio) {
      setMensajeError(
        'La fecha de fin del año lectivo debe ser posterior a la fecha de inicio.',
      );
      return;
    }

    setEnviando(true);
    setMensajeError(null);
    try {
      const creado = await servicio.crearAnioLectivo({
        nombre: nombreAnio,
        inicio: inicioAnio,
        fin: finAnio,
        activo: anioActivoFlag,
      });
      setAniosLectivos((previos) => [creado, ...previos]);
      setAnioSeleccionadoId(creado.id);
      await cargarDatosPorAnio(creado.id);
      setNombreAnio('');
      setInicioAnio('');
      setFinAnio('');
      setMensajeExito(`Año lectivo "${creado.nombre}" registrado correctamente.`);
    } catch (error) {
      setMensajeError(
        extraerMensajeError(error, 'No se pudo crear el año lectivo.'),
      );
    } finally {
      setEnviando(false);
    }
  };

  const manejarCrearDiaNoDictado = async (
    evento: FormEvent<HTMLFormElement>,
  ) => {
    evento.preventDefault();
    setMensajeExito(null);

    if (!anioSeleccionadoId) {
      setMensajeError(
        'Seleccione o cree un año lectivo antes de registrar un día no dictado.',
      );
      return;
    }
    if (!fechaFeriado || !motivoFeriado.trim()) {
      setMensajeError('Ingrese la fecha y el motivo del día no dictado.');
      return;
    }

    setEnviando(true);
    setMensajeError(null);
    try {
      const creado = await servicio.crearDiaNoDictado(anioSeleccionadoId, {
        fecha: fechaFeriado,
        motivo: motivoFeriado,
      });
      setDiasNoDictados((previos) => [...previos, creado]);
      setFechaFeriado('');
      setMotivoFeriado('');
      setMensajeExito(`Día no dictado (${creado.fecha}) registrado.`);
    } catch (error) {
      setMensajeError(
        extraerMensajeError(error, 'No se pudo registrar el día no dictado.'),
      );
    } finally {
      setEnviando(false);
    }
  };

  const manejarCrearCurso = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExito(null);

    if (!anioSeleccionadoId) {
      setMensajeError(
        'Seleccione o cree un año lectivo antes de registrar un curso.',
      );
      return;
    }
    if (!nivelCurso.trim() || !paraleloCurso.trim()) {
      setMensajeError('Ingrese el nivel (ej. 9no EGB) y el paralelo (ej. A).');
      return;
    }

    setEnviando(true);
    setMensajeError(null);
    try {
      const creado = await servicio.crearCurso({
        anioLectivoId: anioSeleccionadoId,
        nivel: nivelCurso,
        paralelo: paraleloCurso,
      });
      setCursos((previos) => [...previos, creado]);
      setNivelCurso('');
      setParaleloCurso('');
      setMensajeExito(
        `Curso "${creado.nivel} · Paralelo ${creado.paralelo}" creado correctamente.`,
      );
    } catch (error) {
      setMensajeError(
        extraerMensajeError(error, 'No se pudo crear el curso y paralelo.'),
      );
    } finally {
      setEnviando(false);
    }
  };

  const manejarCrearMateria = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExito(null);

    if (!nombreMateria.trim() || !areaMateria.trim()) {
      setMensajeError('Ingrese el nombre y el área curricular de la materia.');
      return;
    }

    setEnviando(true);
    setMensajeError(null);
    try {
      const creada = await servicio.crearMateria({
        nombre: nombreMateria,
        area: areaMateria,
      });
      setMaterias((previas) => [...previas, creada]);
      setNombreMateria('');
      setAreaMateria('');
      setMensajeExito(`Materia "${creada.nombre}" registrada correctamente.`);
    } catch (error) {
      setMensajeError(
        extraerMensajeError(error, 'No se pudo registrar la materia.'),
      );
    } finally {
      setEnviando(false);
    }
  };

  const anioActual = aniosLectivos.find((a) => a.id === anioSeleccionadoId);

  return (
    <section
      aria-label="Configuración académica institucional"
      data-testid="pantalla-configuracion-academica"
      className="space-y-6"
    >
      {/* Encabezado del módulo */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">
              Sprint 4 · RF-06, RF-07 y RF-08
            </span>
            <h2 className="font-display text-2xl font-bold text-primary mt-2">
              Configuración académica
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Administre años lectivos, días no dictados, cursos con paralelos y
              catálogo de materias institucionales.
            </p>
          </div>

          {aniosLectivos.length > 0 && (
            <div className="space-y-1 min-w-[220px]">
              <label
                htmlFor="selector-anio-lectivo"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Año lectivo seleccionado
              </label>
              <select
                id="selector-anio-lectivo"
                data-testid="selector-anio-lectivo"
                value={anioSeleccionadoId}
                onChange={(e) => {
                  manejarCambioAnioSeleccionado(e.target.value).catch(
                    () => undefined,
                  );
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-surface text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {aniosLectivos.map((anio) => (
                  <option key={anio.id} value={anio.id}>
                    {anio.nombre} {anio.activo ? '(Activo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navegación por pestañas */}
        <div
          role="tablist"
          aria-label="Secciones de configuración académica"
          className="flex flex-wrap gap-2 pt-2 border-t border-slate-100"
        >
          <button
            type="button"
            role="tab"
            aria-selected={pestanaActiva === 'anios-lectivos'}
            data-testid="tab-anios-lectivos"
            onClick={() => setPestanaActiva('anios-lectivos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              pestanaActiva === 'anios-lectivos'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            Años lectivos y feriados ({aniosLectivos.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={pestanaActiva === 'cursos'}
            data-testid="tab-cursos"
            onClick={() => setPestanaActiva('cursos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              pestanaActiva === 'cursos'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            Cursos y paralelos ({cursos.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={pestanaActiva === 'materias'}
            data-testid="tab-materias"
            onClick={() => setPestanaActiva('materias')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              pestanaActiva === 'materias'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            Materias ({materias.length})
          </button>
        </div>
      </div>

      {mensajeError && (
        <div
          role="alert"
          data-testid="alerta-error-configuracion"
          className="rounded-xl p-4 bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs sm:text-sm"
        >
          <AlertTriangle
            className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{mensajeError}</span>
        </div>
      )}

      {mensajeExito && (
        <div
          role="status"
          data-testid="alerta-exito-configuracion"
          className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs sm:text-sm"
        >
          <CheckCircle2
            className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{mensajeExito}</span>
        </div>
      )}

      {cargando && (
        <div
          data-testid="estado-cargando-configuracion"
          className="bg-white rounded-2xl p-6 border border-slate-200/80 text-sm text-slate-500"
        >
          Cargando configuración académica…
        </div>
      )}

      {!cargando && pestanaActiva === 'anios-lectivos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel: Años lectivos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" aria-hidden="true" />
              Años lectivos
            </h3>

            <form
              onSubmit={manejarCrearAnioLectivo}
              className="space-y-3 bg-surface rounded-xl p-4 border border-slate-200/70"
              noValidate
            >
              <div className="space-y-1">
                <label
                  htmlFor="campo-nombre-anio"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Nombre del año lectivo
                </label>
                <input
                  id="campo-nombre-anio"
                  type="text"
                  placeholder="Ej. 2026-2027"
                  value={nombreAnio}
                  onChange={(e) => setNombreAnio(e.target.value)}
                  disabled={enviando}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="campo-inicio-anio"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Fecha de inicio
                  </label>
                  <input
                    id="campo-inicio-anio"
                    type="date"
                    value={inicioAnio}
                    onChange={(e) => setInicioAnio(e.target.value)}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="campo-fin-anio"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Fecha de fin
                  </label>
                  <input
                    id="campo-fin-anio"
                    type="date"
                    value={finAnio}
                    onChange={(e) => setFinAnio(e.target.value)}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anioActivoFlag}
                  onChange={(e) => setAnioActivoFlag(e.target.checked)}
                  disabled={enviando}
                  className="rounded border-slate-300 text-primary"
                />
                Marcar como año lectivo activo
              </label>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={enviando}
                  data-testid="boton-crear-anio"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Registrar año lectivo
                </button>
              </div>
            </form>

            <ul
              data-testid="lista-anios-lectivos"
              className="divide-y divide-slate-100"
            >
              {aniosLectivos.length === 0 ? (
                <li className="py-4 text-xs text-slate-500">
                  Aún no existen años lectivos registrados.
                </li>
              ) : (
                aniosLectivos.map((anio) => (
                  <li
                    key={anio.id}
                    className="py-3 flex items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-primary">
                        {anio.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {anio.inicio} — {anio.fin}
                      </p>
                    </div>
                    {anio.activo && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Activo
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Panel: Días no dictados (RF-08) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-accent" aria-hidden="true" />
              Días no dictados {anioActual ? `(${anioActual.nombre})` : ''}
            </h3>

            <form
              onSubmit={manejarCrearDiaNoDictado}
              className="space-y-3 bg-surface rounded-xl p-4 border border-slate-200/70"
              noValidate
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="campo-fecha-feriado"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Fecha
                  </label>
                  <input
                    id="campo-fecha-feriado"
                    type="date"
                    value={fechaFeriado}
                    onChange={(e) => setFechaFeriado(e.target.value)}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="campo-motivo-feriado"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Motivo
                  </label>
                  <input
                    id="campo-motivo-feriado"
                    type="text"
                    placeholder="Ej. Feriado nacional"
                    value={motivoFeriado}
                    onChange={(e) => setMotivoFeriado(e.target.value)}
                    disabled={enviando}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={enviando}
                  data-testid="boton-crear-feriado"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Agregar día no dictado
                </button>
              </div>
            </form>

            <ul
              data-testid="lista-dias-no-dictados"
              className="divide-y divide-slate-100"
            >
              {diasNoDictados.length === 0 ? (
                <li className="py-4 text-xs text-slate-500">
                  No hay días no dictados registrados para este año lectivo.
                </li>
              ) : (
                diasNoDictados.map((dia) => (
                  <li
                    key={dia.id}
                    className="py-3 flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-mono text-xs font-semibold text-primary">
                      {dia.fecha}
                    </span>
                    <span className="text-xs text-slate-600">{dia.motivo}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {!cargando && pestanaActiva === 'cursos' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" aria-hidden="true" />
            Cursos y paralelos (RF-06)
          </h3>

          <form
            onSubmit={manejarCrearCurso}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface rounded-xl p-4 border border-slate-200/70 items-end"
            noValidate
          >
            <div className="space-y-1">
              <label
                htmlFor="campo-nivel-curso"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Nivel / Curso
              </label>
              <input
                id="campo-nivel-curso"
                type="text"
                placeholder="Ej. 9no EGB"
                value={nivelCurso}
                onChange={(e) => setNivelCurso(e.target.value)}
                disabled={enviando}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="campo-paralelo-curso"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Paralelo
              </label>
              <input
                id="campo-paralelo-curso"
                type="text"
                placeholder="Ej. A"
                maxLength={5}
                value={paraleloCurso}
                onChange={(e) => setParaleloCurso(e.target.value)}
                disabled={enviando}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              data-testid="boton-crear-curso"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Crear curso
            </button>
          </form>

          <div
            data-testid="lista-cursos"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {cursos.length === 0 ? (
              <p className="text-xs text-slate-500 col-span-full">
                No hay cursos registrados para el año lectivo seleccionado.
              </p>
            ) : (
              cursos.map((curso) => (
                <div
                  key={curso.id}
                  className="p-4 rounded-xl border border-slate-200 bg-surface/50 flex items-center justify-between"
                >
                  <span className="font-display font-bold text-primary">
                    {curso.nivel}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-accent-light text-accent-dark">
                    Paralelo {curso.paralelo}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!cargando && pestanaActiva === 'materias' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" aria-hidden="true" />
            Catálogo de materias (RF-07)
          </h3>

          <form
            onSubmit={manejarCrearMateria}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface rounded-xl p-4 border border-slate-200/70 items-end"
            noValidate
          >
            <div className="space-y-1">
              <label
                htmlFor="campo-nombre-materia"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Nombre de la materia
              </label>
              <input
                id="campo-nombre-materia"
                type="text"
                placeholder="Ej. Matemática"
                value={nombreMateria}
                onChange={(e) => setNombreMateria(e.target.value)}
                disabled={enviando}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="campo-area-materia"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Área curricular
              </label>
              <input
                id="campo-area-materia"
                type="text"
                placeholder="Ej. Ciencias Exactas"
                value={areaMateria}
                onChange={(e) => setAreaMateria(e.target.value)}
                disabled={enviando}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              data-testid="boton-crear-materia"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Registrar materia
            </button>
          </form>

          <ul
            data-testid="lista-materias"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {materias.length === 0 ? (
              <li className="text-xs text-slate-500 col-span-full">
                No existen materias registradas en el catálogo.
              </li>
            ) : (
              materias.map((materia) => (
                <li
                  key={materia.id}
                  className="p-4 rounded-xl border border-slate-200 bg-surface/50 space-y-1"
                >
                  <p className="font-display font-bold text-primary">
                    {materia.nombre}
                  </p>
                  <p className="text-xs text-slate-600">{materia.area}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
