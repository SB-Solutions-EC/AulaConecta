import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { clienteHttp, type CodigoRol } from './api/clienteHttp';
import { LayoutPwa } from './componentes/LayoutPwa';
import {
  CATALOGO_MODULOS,
  METADATOS_ROLES,
  RutaProtegida,
  buscarModuloPorRuta,
} from './rutas/rutasProtegidas';

export type EstadoSalud = 'UP' | 'DOWN' | 'CHECKING';

export interface ServicioMonitorizado {
  id: string;
  nombre: string;
  tecnologia: string;
  rutaSalud: string;
  descripcion: string;
  estado: EstadoSalud;
}

const SERVICIOS_INICIALES: ServicioMonitorizado[] = [
  {
    id: 'ms-identidad',
    nombre: 'ms-identidad',
    tecnologia: 'Spring Boot 4 · Java 21',
    rutaSalud: '/api/identidad/health',
    descripcion: 'Usuarios, roles, inicio de sesión, JWT RS256 y JWKS',
    estado: 'CHECKING',
  },
  {
    id: 'ms-academico',
    nombre: 'ms-academico',
    tecnologia: 'NestJS · TypeScript',
    rutaSalud: '/api/academico/health',
    descripcion: 'Matrícula, planificación ERCA, calificaciones y sincronización',
    estado: 'CHECKING',
  },
  {
    id: 'ms-notificaciones',
    nombre: 'ms-notificaciones',
    tecnologia: 'FastAPI · Python 3.12',
    rutaSalud: '/api/notificaciones/health',
    descripcion: 'Consentimiento y avisos por Web Push y WhatsApp',
    estado: 'CHECKING',
  },
];

async function consultarSaludServicio(ruta: string): Promise<EstadoSalud> {
  try {
    const datos = await clienteHttp.get<{ status?: string }>(ruta, {
      omitirAutenticacion: true,
    });
    return datos?.status === 'UP' ? 'UP' : 'DOWN';
  } catch {
    return 'DOWN';
  }
}

export default function App() {
  const [servicios, setServicios] =
    useState<ServicioMonitorizado[]>(SERVICIOS_INICIALES);
  const [enLinea, setEnLinea] = useState<boolean>(navigator.onLine);
  const [rolActivo, setRolActivo] = useState<CodigoRol>('ADMIN');
  const [rutaActiva, setRutaActiva] = useState<string>('/panel');
  const [autenticado, setAutenticado] = useState<boolean>(true);
  const [debeCambiarClave, setDebeCambiarClave] = useState<boolean>(false);

  const verificarServicios = useCallback(async () => {
    setServicios((previos) =>
      previos.every((s) => s.estado === 'CHECKING')
        ? previos
        : previos.map((s) => ({ ...s, estado: 'CHECKING' })),
    );

    const actualizados = await Promise.all(
      SERVICIOS_INICIALES.map(async (servicio) => {
        const estado = await consultarSaludServicio(servicio.rutaSalud);
        return { ...servicio, estado };
      }),
    );

    setServicios(actualizados);
  }, []);

  useEffect(() => {
    verificarServicios().catch(() => undefined);

    const manejarOnline = () => setEnLinea(true);
    const manejarOffline = () => setEnLinea(false);

    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);

    const cancelarExpiracion = clienteHttp.alExpirarSesion(() => {
      setAutenticado(false);
    });
    const cancelarCambioClave = clienteHttp.alRequerirCambioClave(() => {
      setDebeCambiarClave(true);
    });

    return () => {
      window.removeEventListener('online', manejarOnline);
      window.removeEventListener('offline', manejarOffline);
      cancelarExpiracion();
      cancelarCambioClave();
    };
  }, [verificarServicios]);

  const moduloActual = buscarModuloPorRuta(rutaActiva) ?? CATALOGO_MODULOS[0];
  const metadatosRol = METADATOS_ROLES[rolActivo];

  return (
    <LayoutPwa
      rolActivo={rolActivo}
      rutaActiva={moduloActual.ruta}
      enLinea={enLinea}
      nombreUsuario="ana.perez"
      debeCambiarClave={debeCambiarClave}
      alCambiarRol={setRolActivo}
      alNavegar={setRutaActiva}
    >
      {/* Controles de estado de sesión y seguridad para validación de guardas (RF-01, RF-03) */}
      <section
        aria-label="Controles de sesión y rutas protegidas"
        className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="space-y-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
            Ruta activa: <code className="font-mono">{moduloActual.ruta}</code>
          </span>
          <p className="text-xs text-slate-600">
            Módulo: <strong>{moduloActual.etiqueta}</strong> · Guardas de
            autenticación, rol y clave inicial (`RF-01`, `RF-03`).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="toggle-cambio-clave"
            onClick={() => setDebeCambiarClave((previo) => !previo)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              debeCambiarClave
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-surface text-slate-700 border-slate-200 hover:bg-slate-200/60'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            {debeCambiarClave
              ? 'Clave inicial pendiente (RF-03)'
              : 'Simular clave inicial'}
          </button>

          <button
            type="button"
            data-testid="toggle-sesion"
            onClick={() => setAutenticado((previo) => !previo)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface text-slate-700 border border-slate-200 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            {autenticado ? 'Simular expiración 401' : 'Restaurar sesión'}
          </button>
        </div>
      </section>

      <RutaProtegida
        autenticado={autenticado}
        debeCambiarClave={debeCambiarClave}
        rolActivo={rolActivo}
        rolesPermitidos={moduloActual.rolesPermitidos}
        tituloModulo={moduloActual.etiqueta}
        alSolicitarInicioSesion={() => setAutenticado(true)}
        alCompletarCambioClave={() => setDebeCambiarClave(false)}
        alVolverAlPanel={() => setRutaActiva('/panel')}
      >
        {moduloActual.ruta === '/panel' ? (
          <VistaPanelGeneral
            servicios={servicios}
            etiquetaRol={metadatosRol.etiqueta}
            alVerificarServicios={() => {
              verificarServicios().catch(() => undefined);
            }}
          />
        ) : (
          <section
            aria-label={`Contenido del módulo ${moduloActual.etiqueta}`}
            data-testid={`vista-modulo-${moduloActual.id}`}
            className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">
                {moduloActual.sprintObjetivo}
              </span>
              <span className="text-xs font-mono text-slate-500">
                Ruta protegida: {moduloActual.ruta}
              </span>
            </div>

            <h2 className="font-display text-2xl font-bold text-primary">
              {moduloActual.etiqueta}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {moduloActual.descripcion}
            </p>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Roles autorizados:</span>
              {moduloActual.rolesPermitidos.map((codigo) => (
                <span
                  key={codigo}
                  className="px-2.5 py-0.5 rounded-full bg-surface text-primary font-semibold border border-slate-200"
                >
                  {METADATOS_ROLES[codigo].etiqueta}
                </span>
              ))}
            </div>
          </section>
        )}
      </RutaProtegida>
    </LayoutPwa>
  );
}

interface PropiedadesVistaPanelGeneral {
  servicios: ServicioMonitorizado[];
  etiquetaRol: string;
  alVerificarServicios: () => void;
}

function VistaPanelGeneral({
  servicios,
  etiquetaRol,
  alVerificarServicios,
}: Readonly<PropiedadesVistaPanelGeneral>) {
  return (
    <div className="space-y-6">
      {/* Hero / Resumen de arquitectura */}
      <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">
            Sprint 4 · Layout por rol, rutas protegidas y cliente HTTP con token
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            Plataforma de Gestión Académica y Avisos Oportunos
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Planificación microcurricular ERCA con revisión digital, cálculo
            automático de calificaciones idéntico a las hojas oficiales, trabajo
            sin conexión (IndexedDB) y avisos a representantes por Web Push y
            WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={alVerificarServicios}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Verificar servicios (/health)
        </button>
      </section>

      {/* Estado de los microservicios (/health a través del gateway) */}
      <section aria-label="Estado de los microservicios" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" aria-hidden="true" />
            Estado de los microservicios a través del Gateway
          </h3>
          <span className="text-xs text-slate-500">
            Vista activa para: <strong>{etiquetaRol}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {servicios.map((servicio) => (
            <article
              key={servicio.id}
              data-testid={`tarjeta-${servicio.id}`}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-base text-primary">
                    {servicio.nombre}
                  </span>
                  <InsigniaEstado estado={servicio.estado} />
                </div>
                <p className="text-xs font-medium text-accent-dark">
                  {servicio.tecnologia}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {servicio.descripcion}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>GET {servicio.rutaSalud}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Pilares funcionales */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-accent-light text-accent-dark">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm text-primary">
              Identidad y Seguridad
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              JWT RS256 en memoria, rotación de sesión, bloqueo tras 3 intentos
              y auditoría inmutable.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-accent-light text-accent-dark">
            <BookOpen className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm text-primary">
              Gestión Académica y Offline
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Cálculo exacto en línea y sin conexión con control de versiones
              por UUID.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-accent-light text-accent-dark">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm text-primary">
              Avisos por Niveles
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Web Push gratuito, WhatsApp asistido (wa.me) y WhatsApp Cloud API
              opcional.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function InsigniaEstado({ estado }: Readonly<{ estado: EstadoSalud }>) {
  if (estado === 'UP') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        UP
      </span>
    );
  }
  if (estado === 'DOWN') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
        DOWN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Verificando…
    </span>
  );
}
