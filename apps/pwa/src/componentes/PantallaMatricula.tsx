import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareCheck,
  Plus,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  servicioAcademicoConfigApi,
  type Curso,
  type ServicioAcademicoConfigApi,
} from '../api/academicoConfigApi';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  servicioMatriculasApi,
  type ContactoNotificacion,
  type Matricula,
  type PersonaAcademica,
  type ServicioMatriculasApi,
} from '../api/matriculasApi';

export type PestanaMatricula = 'matricula' | 'consentimiento';

export interface PropiedadesPantallaMatricula {
  servicioMatriculas?: Pick<
    ServicioMatriculasApi,
    | 'listarEstudiantes'
    | 'listarRepresentantes'
    | 'crearPersona'
    | 'crearRepresentacion'
    | 'listarMatriculas'
    | 'crearMatricula'
    | 'listarContactos'
    | 'crearContacto'
    | 'actualizarConsentimiento'
  >;
  servicioAcademico?: Pick<ServicioAcademicoConfigApi, 'listarCursos'>;
}

const PATRON_CEDULA_10 = /^\d{10}$/;
const PATRON_WHATSAPP_E164 = /^\+[1-9]\d{7,14}$/;

const PARENTESCOS_SUGERIDOS = [
  'Madre',
  'Padre',
  'Representante legal',
  'Abuelo/a',
  'Tío/a',
];

function extraerMensajeError(error: unknown, respaldo: string): string {
  if (error instanceof ErrorHttpApi) {
    return error.message || `${respaldo} (${error.codigo})`;
  }
  return respaldo;
}

export function PantallaMatricula({
  servicioMatriculas = servicioMatriculasApi,
  servicioAcademico = servicioAcademicoConfigApi,
}: Readonly<PropiedadesPantallaMatricula>) {
  const [pestana, setPestana] = useState<PestanaMatricula>('matricula');

  const [estudiantes, setEstudiantes] = useState<PersonaAcademica[]>([]);
  const [representantes, setRepresentantes] = useState<PersonaAcademica[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [contactos, setContactos] = useState<ContactoNotificacion[]>([]);

  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [modoEstudiante, setModoEstudiante] = useState<'nuevo' | 'existente'>('nuevo');
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('');
  const [estudianteNombres, setEstudianteNombres] = useState('');
  const [estudianteApellidos, setEstudianteApellidos] = useState('');
  const [estudianteCedula, setEstudianteCedula] = useState('');

  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState('');
  const [filtroCursoId, setFiltroCursoId] = useState('');

  const [modoRepresentante, setModoRepresentante] = useState<'nuevo' | 'existente'>(
    'nuevo',
  );
  const [representanteSeleccionadoId, setRepresentanteSeleccionadoId] =
    useState('');
  const [representanteNombres, setRepresentanteNombres] = useState('');
  const [representanteApellidos, setRepresentanteApellidos] = useState('');
  const [representanteCedula, setRepresentanteCedula] = useState('');
  const [parentesco, setParentesco] = useState('Madre');

  const [whatsapp, setWhatsapp] = useState('');
  const [autorizaAvisos, setAutorizaAvisos] = useState(true);

  const [guardandoMatricula, setGuardandoMatricula] = useState(false);
  const [actualizandoContactoId, setActualizandoContactoId] = useState<
    string | null
  >(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorGlobal(null);
    try {
      const [
        listaEstudiantes,
        listaRepresentantes,
        listaCursos,
        listaMatriculas,
        listaContactos,
      ] = await Promise.all([
        servicioMatriculas.listarEstudiantes(),
        servicioMatriculas.listarRepresentantes(),
        servicioAcademico.listarCursos(),
        servicioMatriculas.listarMatriculas(),
        servicioMatriculas.listarContactos(),
      ]);

      setEstudiantes(listaEstudiantes);
      setRepresentantes(listaRepresentantes);
      setCursos(listaCursos);
      setMatriculas(listaMatriculas);
      setContactos(listaContactos);

      if (listaEstudiantes.length > 0) {
        setEstudianteSeleccionadoId((actual) => actual || listaEstudiantes[0].id);
      }
      if (listaRepresentantes.length > 0) {
        setRepresentanteSeleccionadoId(
          (actual) => actual || listaRepresentantes[0].id,
        );
      }
      if (listaCursos.length > 0) {
        setCursoSeleccionadoId((actual) => actual || listaCursos[0].id);
      }
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(
          error,
          'No se pudo cargar el módulo de matrícula y representantes.',
        ),
      );
    } finally {
      setCargando(false);
    }
  }, [servicioMatriculas, servicioAcademico]);

  useEffect(() => {
    cargarDatos().catch(() => undefined);
  }, [cargarDatos]);

  const resolverEstudianteId = async (): Promise<string | null> => {
    if (modoEstudiante === 'existente') {
      if (!estudianteSeleccionadoId) {
        setErrorGlobal('Selecciona un estudiante existente.');
        return null;
      }
      return estudianteSeleccionadoId;
    }

    const nombres = estudianteNombres.trim();
    const apellidos = estudianteApellidos.trim();
    const cedula = estudianteCedula.trim();

    if (!nombres || !apellidos || !cedula) {
      setErrorGlobal(
        'Completa nombres, apellidos y cédula del estudiante.',
      );
      return null;
    }
    if (!PATRON_CEDULA_10.test(cedula)) {
      setErrorGlobal(
        'La cédula del estudiante debe tener exactamente 10 dígitos numéricos.',
      );
      return null;
    }

    const creado = await servicioMatriculas.crearPersona({
      tipo: 'ESTUDIANTE',
      nombres,
      apellidos,
      cedula,
    });
    return creado.id;
  };

  const resolverRepresentanteId = async (): Promise<string | null> => {
    if (modoRepresentante === 'existente') {
      if (!representanteSeleccionadoId) {
        setErrorGlobal('Selecciona un representante existente.');
        return null;
      }
      return representanteSeleccionadoId;
    }

    const nombres = representanteNombres.trim();
    const apellidos = representanteApellidos.trim();
    const cedula = representanteCedula.trim();

    if (!nombres || !apellidos || !cedula) {
      setErrorGlobal(
        'Completa nombres, apellidos y cédula del representante.',
      );
      return null;
    }
    if (!PATRON_CEDULA_10.test(cedula)) {
      setErrorGlobal(
        'La cédula del representante debe tener exactamente 10 dígitos numéricos.',
      );
      return null;
    }

    const creado = await servicioMatriculas.crearPersona({
      tipo: 'REPRESENTANTE',
      nombres,
      apellidos,
      cedula,
    });
    return creado.id;
  };

  const manejarRegistrarMatricula = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensajeExito(null);
    setErrorGlobal(null);

    if (!cursoSeleccionadoId) {
      setErrorGlobal('Selecciona un curso para matricular al estudiante.');
      return;
    }

    const parentescoLimpio = parentesco.trim();
    if (!parentescoLimpio) {
      setErrorGlobal('Indica el parentesco del representante.');
      return;
    }

    const whatsappLimpio = whatsapp.trim();
    if (!PATRON_WHATSAPP_E164.test(whatsappLimpio)) {
      setErrorGlobal(
        'Ingresa el número de WhatsApp en formato internacional E.164 (ej. +593000000000).',
      );
      return;
    }

    setGuardandoMatricula(true);
    try {
      const estudianteId = await resolverEstudianteId();
      if (!estudianteId) {
        return;
      }

      const representanteId = await resolverRepresentanteId();
      if (!representanteId) {
        return;
      }

      await servicioMatriculas.crearRepresentacion({
        estudianteId,
        representanteId,
        parentesco: parentescoLimpio,
      });

      await servicioMatriculas.crearMatricula({
        estudianteId,
        cursoId: cursoSeleccionadoId,
      });

      await servicioMatriculas.crearContacto({
        representanteId,
        estudianteId,
        whatsapp: whatsappLimpio,
        autorizaAvisos,
      });

      setEstudianteNombres('');
      setEstudianteApellidos('');
      setEstudianteCedula('');
      setRepresentanteNombres('');
      setRepresentanteApellidos('');
      setRepresentanteCedula('');
      setWhatsapp('');

      setMensajeExito(
        autorizaAvisos
          ? 'Matrícula registrada con representante y autorización de WhatsApp en ms-notificaciones.'
          : 'Matrícula registrada con representante (avisos por WhatsApp desactivados).',
      );

      await cargarDatos();
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(
          error,
          'No se pudo completar el registro de matrícula y contacto.',
        ),
      );
    } finally {
      setGuardandoMatricula(false);
    }
  };

  const manejarAlternarConsentimiento = async (
    contacto: ContactoNotificacion,
  ) => {
    setErrorGlobal(null);
    setMensajeExito(null);
    setActualizandoContactoId(contacto.id);

    try {
      const actualizado = await servicioMatriculas.actualizarConsentimiento(
        contacto.id,
        {
          autorizaAvisos: !contacto.autorizaAvisos,
          version: contacto.version,
        },
      );
      setContactos((prev) =>
        prev.map((item) => (item.id === actualizado.id ? actualizado : item)),
      );
      setMensajeExito(
        actualizado.autorizaAvisos
          ? `Autorización de WhatsApp activada para ${actualizado.whatsapp}.`
          : `Baja de avisos aplicada para ${actualizado.whatsapp}.`,
      );
    } catch (error) {
      setErrorGlobal(
        extraerMensajeError(
          error,
          'No se pudo actualizar el consentimiento de WhatsApp.',
        ),
      );
    } finally {
      setActualizandoContactoId(null);
    }
  };

  const obtenerNombrePersona = (
    lista: PersonaAcademica[],
    personaId: string,
  ): string => {
    const persona = lista.find((item) => item.id === personaId);
    return persona ? `${persona.apellidos} ${persona.nombres}` : personaId;
  };

  const obtenerNombreCurso = (cursoId: string): string => {
    const curso = cursos.find((item) => item.id === cursoId);
    return curso ? `${curso.nivel} "${curso.paralelo}"` : cursoId;
  };

  const obtenerContactoPorEstudiante = (
    estudianteId: string,
  ): ContactoNotificacion | undefined =>
    contactos.find((item) => item.estudianteId === estudianteId);

  const matriculasFiltradas = filtroCursoId
    ? matriculas.filter((item) => item.cursoId === filtroCursoId)
    : matriculas;

  return (
    <section
      data-testid="pantalla-matricula"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
    >
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full mb-2">
            Matrícula individual · RF-04, RF-29
          </span>
          <h2 className="text-2xl font-bold text-slate-900">
            Matrícula y Datos del Representante
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Matricula estudiantes en su curso, vincula a su representante legal y registra su número de WhatsApp y consentimiento en ms-notificaciones.
          </p>
        </div>
      </header>

      <nav
        aria-label="Secciones de matrícula y consentimiento"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          onClick={() => {
            setPestana('matricula');
            setErrorGlobal(null);
            setMensajeExito(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            pestana === 'matricula'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Matrícula individual
        </button>

        <button
          type="button"
          onClick={() => {
            setPestana('consentimiento');
            setErrorGlobal(null);
            setMensajeExito(null);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            pestana === 'consentimiento'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MessageSquareCheck className="w-4 h-4" />
          Contactos y consentimiento WhatsApp
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
          Cargando información de matrícula y contactos...
        </p>
      ) : null}

      {!cargando && pestana === 'matricula' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={manejarRegistrarMatricula}
            className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5 h-fit"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  1. Datos del estudiante
                </h3>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoEstudiante('nuevo')}
                    className={`px-2.5 py-1 rounded-lg font-medium ${
                      modoEstudiante === 'nuevo'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoEstudiante('existente')}
                    className={`px-2.5 py-1 rounded-lg font-medium ${
                      modoEstudiante === 'existente'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Existente
                  </button>
                </div>
              </div>

              {modoEstudiante === 'existente' ? (
                <div>
                  <label
                    htmlFor="matricula-estudiante-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Estudiante registrado
                  </label>
                  <select
                    id="matricula-estudiante-select"
                    value={estudianteSeleccionadoId}
                    onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona un estudiante</option>
                    {estudiantes.map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.apellidos} {est.nombres}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="estudiante-nombres"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nombres del estudiante
                    </label>
                    <input
                      id="estudiante-nombres"
                      type="text"
                      value={estudianteNombres}
                      onChange={(e) => setEstudianteNombres(e.target.value)}
                      placeholder="Ej. Mateo Andrés"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="estudiante-apellidos"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Apellidos del estudiante
                    </label>
                    <input
                      id="estudiante-apellidos"
                      type="text"
                      value={estudianteApellidos}
                      onChange={(e) => setEstudianteApellidos(e.target.value)}
                      placeholder="Ej. Salazar Gómez"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="estudiante-cedula"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Cédula del estudiante
                    </label>
                    <input
                      id="estudiante-cedula"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={estudianteCedula}
                      onChange={(e) => setEstudianteCedula(e.target.value)}
                      placeholder="9900000001"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="matricula-curso"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Curso a matricular
                </label>
                <select
                  id="matricula-curso"
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
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  2. Representante y WhatsApp (RF-29)
                </h3>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoRepresentante('nuevo')}
                    className={`px-2.5 py-1 rounded-lg font-medium ${
                      modoRepresentante === 'nuevo'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoRepresentante('existente')}
                    className={`px-2.5 py-1 rounded-lg font-medium ${
                      modoRepresentante === 'existente'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Existente
                  </button>
                </div>
              </div>

              {modoRepresentante === 'existente' ? (
                <div>
                  <label
                    htmlFor="matricula-representante-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Representante registrado
                  </label>
                  <select
                    id="matricula-representante-select"
                    value={representanteSeleccionadoId}
                    onChange={(e) =>
                      setRepresentanteSeleccionadoId(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona un representante</option>
                    {representantes.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.apellidos} {rep.nombres}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="representante-nombres"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nombres del representante
                    </label>
                    <input
                      id="representante-nombres"
                      type="text"
                      value={representanteNombres}
                      onChange={(e) => setRepresentanteNombres(e.target.value)}
                      placeholder="Ej. María Elena"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="representante-apellidos"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Apellidos del representante
                    </label>
                    <input
                      id="representante-apellidos"
                      type="text"
                      value={representanteApellidos}
                      onChange={(e) =>
                        setRepresentanteApellidos(e.target.value)
                      }
                      placeholder="Ej. Gómez Vera"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="representante-cedula"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Cédula del representante
                    </label>
                    <input
                      id="representante-cedula"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={representanteCedula}
                      onChange={(e) => setRepresentanteCedula(e.target.value)}
                      placeholder="9900000002"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="matricula-parentesco"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Parentesco
                  </label>
                  <select
                    id="matricula-parentesco"
                    value={parentesco}
                    onChange={(e) => setParentesco(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PARENTESCOS_SUGERIDOS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="representante-whatsapp"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    WhatsApp (formato E.164)
                  </label>
                  <input
                    id="representante-whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+593000000000"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autorizaAvisos}
                  onChange={(e) => setAutorizaAvisos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong className="text-slate-900">
                    Autorización expresa del representante:
                  </strong>{' '}
                  autoriza recibir avisos académicos por WhatsApp (se registra en
                  ms-notificaciones con fecha de autorización y mensaje de
                  confirmación).
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={guardandoMatricula}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              {guardandoMatricula ? 'Registrando...' : 'Registrar matrícula'}
            </button>
          </form>

          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Matrículas registradas
              </h3>
              <select
                aria-label="Filtrar matrículas por curso"
                value={filtroCursoId}
                onChange={(e) => setFiltroCursoId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="">Todos los cursos</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nivel} "{curso.paralelo}"
                  </option>
                ))}
              </select>
            </div>

            {matriculasFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No existen matrículas registradas para los criterios actuales.
              </div>
            ) : (
              <ul className="space-y-3" data-testid="lista-matriculas">
                {matriculasFiltradas.map((matricula) => {
                  const contacto = obtenerContactoPorEstudiante(
                    matricula.estudianteId,
                  );
                  return (
                    <li
                      key={matricula.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {obtenerNombrePersona(estudiantes, matricula.estudianteId)}
                        </p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            matricula.estado === 'ACTIVA'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {matricula.estado}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Curso: {obtenerNombreCurso(matricula.cursoId)}
                      </p>
                      {contacto ? (
                        <p className="text-xs text-slate-500">
                          WhatsApp: {contacto.whatsapp} ·{' '}
                          {contacto.autorizaAvisos
                            ? 'Avisos autorizados'
                            : 'Sin autorización de avisos'}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {!cargando && pestana === 'consentimiento' ? (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Contactos de WhatsApp y estado de consentimiento (ms-notificaciones)
          </h3>

          {contactos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Aún no hay contactos de representantes registrados.
            </div>
          ) : (
            <ul className="space-y-3" data-testid="lista-contactos">
              {contactos.map((contacto) => (
                <li
                  key={contacto.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">
                      {obtenerNombrePersona(
                        representantes,
                        contacto.representanteId,
                      )}{' '}
                      <span className="font-normal text-slate-500">
                        (representa a{' '}
                        {obtenerNombrePersona(estudiantes, contacto.estudianteId)})
                      </span>
                    </p>
                    <p className="text-xs text-slate-600">
                      WhatsApp: <strong>{contacto.whatsapp}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        contacto.autorizaAvisos
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {contacto.autorizaAvisos ? 'Autorizado' : 'Dado de baja'}
                    </span>

                    <button
                      type="button"
                      disabled={actualizandoContactoId === contacto.id}
                      onClick={() => {
                        manejarAlternarConsentimiento(contacto).catch(
                          () => undefined,
                        );
                      }}
                      className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      {contacto.autorizaAvisos
                        ? 'Revocar avisos'
                        : 'Autorizar avisos'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
