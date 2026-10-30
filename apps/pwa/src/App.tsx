import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';

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

const ROLES_PLATAFORMA = [
  'Administrador (Vicerrector)',
  'Secretaría',
  'Docente',
  'Estudiante',
  'Representante',
];

async function consultarSaludServicio(ruta: string): Promise<EstadoSalud> {
  try {
    const respuesta = await fetch(ruta, {
      headers: { Accept: 'application/json' },
    });
    if (!respuesta.ok) {
      return 'DOWN';
    }
    const datos = (await respuesta.json()) as { status?: string };
    return datos.status === 'UP' ? 'UP' : 'DOWN';
  } catch {
    return 'DOWN';
  }
}

export default function App() {
  const [servicios, setServicios] =
    useState<ServicioMonitorizado[]>(SERVICIOS_INICIALES);
  const [enLinea, setEnLinea] = useState<boolean>(navigator.onLine);
  const [rolActivo, setRolActivo] = useState<string>(ROLES_PLATAFORMA[0]);

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
    verificarServicios();

    const manejarOnline = () => setEnLinea(true);
    const manejarOffline = () => setEnLinea(false);

    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);

    return () => {
      window.removeEventListener('online', manejarOnline);
      window.removeEventListener('offline', manejarOffline);
    };
  }, [verificarServicios]);

  return (
    <div className="min-h-screen bg-surface text-slate-800 flex flex-col">
      {/* Barra superior institucional */}
      <header className="bg-primary text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shadow-sm">
              <GraduationCap className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                AulaConecta
              </h1>
              <p className="text-xs sm:text-sm text-slate-200">
                Unidad Educativa &ldquo;Andoas&rdquo; · Puyo, Pastaza
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              data-testid="indicador-red"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                enLinea
                  ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-100 border border-amber-400/30'
              }`}
            >
              {enLinea ? (
                <>
                  <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                  En línea · PWA activa
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                  Sin conexión · Cola local lista
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Hero / Resumen de arquitectura */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">
              Sprint 3 · Esqueleto de arquitectura de 3 microservicios + PWA
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-primary">
              Plataforma de Gestión Académica y Avisos Oportunos
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Planificación microcurricular ERCA con revisión digital, cálculo
              automático de calificaciones idéntico a las hojas oficiales,
              trabajo sin conexión (IndexedDB) y avisos a representantes por Web
              Push y WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              verificarServicios();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Verificar servicios (/health)
          </button>
        </section>

        {/* Selector de vistas por rol (píldoras de la guía visual) */}
        <section aria-label="Roles del sistema" className="space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">
            Roles de AulaConecta (RF-01, RF-38)
          </h3>
          <div className="flex flex-wrap gap-2">
            {ROLES_PLATAFORMA.map((rol) => {
              const activo = rol === rolActivo;
              return (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setRolActivo(rol)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    activo
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {rol}
                </button>
              );
            })}
          </div>
        </section>

        {/* Estado de los microservicios (/health a través del gateway) */}
        <section aria-label="Estado de los microservicios" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" aria-hidden="true" />
              Estado de los microservicios a través del Gateway
            </h3>
            <span className="text-xs text-slate-500">
              Rol seleccionado: <strong>{rolActivo}</strong>
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
                JWT RS256, validación JWKS, bloqueo tras 3 intentos y auditoría
                inmutable.
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
                Web Push gratuito, WhatsApp asistido (wa.me) y WhatsApp Cloud
                API opcional.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        AulaConecta v0.1.0 · SB Solutions · Unidad Educativa &ldquo;Andoas&rdquo;
      </footer>
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
