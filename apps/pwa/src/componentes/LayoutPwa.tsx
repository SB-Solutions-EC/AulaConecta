import { useState, type ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  CalendarCog,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { CodigoRol } from '../api/clienteHttp';
import { normalizarRolesAsignados } from '../api/autenticacionApi';
import {
  METADATOS_ROLES,
  ORDEN_ROLES,
  obtenerModulosPorRol,
  type DefinicionModuloNavegacion,
} from '../rutas/rutasProtegidas';

export interface PropiedadesLayoutPwa {
  rolActivo: CodigoRol;
  rolesAsignados?: readonly CodigoRol[];
  rutaActiva: string;
  enLinea: boolean;
  nombreUsuario: string;
  debeCambiarClave: boolean;
  alCambiarRol: (nuevoRol: CodigoRol) => void;
  alNavegar: (nuevaRuta: string) => void;
  alCerrarSesion?: () => void;
  children: ReactNode;
}

function IconoModulo({ idModulo }: Readonly<{ idModulo: string }>) {
  switch (idModulo) {
    case 'panel-general':
      return <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'configuracion-academica':
      return <CalendarCog className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'personal-docente':
      return <Users className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'matriculas':
      return <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'importacion-nominas':
      return <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'planificaciones-erca':
      return <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'calificaciones-asistencia':
    case 'seguimiento-estudiantil':
      return <ClipboardCheck className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'avisos-notificaciones':
      return <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />;
    default:
      return <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
}

export function LayoutPwa({
  rolActivo,
  rolesAsignados = ORDEN_ROLES,
  rutaActiva,
  enLinea,
  nombreUsuario,
  debeCambiarClave,
  alCambiarRol,
  alNavegar,
  alCerrarSesion,
  children,
}: Readonly<PropiedadesLayoutPwa>) {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);
  const rolesDisponibles = normalizarRolesAsignados(rolesAsignados);
  const modulosDelRol = obtenerModulosPorRol(rolActivo);
  const metadatosRol = METADATOS_ROLES[rolActivo];

  const manejarSeleccionRuta = (modulo: DefinicionModuloNavegacion) => {
    alNavegar(modulo.ruta);
    setMenuMovilAbierto(false);
  };

  return (
    <div className="min-h-screen bg-surface text-slate-800 flex flex-col">
      {/* Barra superior institucional */}
      <header className="bg-primary text-white shadow-md z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={
                menuMovilAbierto ? 'Cerrar menú lateral' : 'Abrir menú lateral'
              }
              aria-expanded={menuMovilAbierto}
              onClick={() => setMenuMovilAbierto((previo) => !previo)}
              className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              {menuMovilAbierto ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>

            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-sm">
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

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-xs text-slate-100">
              <span>Sesión:</span>
              <strong data-testid="usuario-sesion-activa">{nombreUsuario}</strong>
              {debeCambiarClave && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30 font-semibold">
                  Clave inicial
                </span>
              )}
            </div>

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

            {alCerrarSesion && (
              <button
                type="button"
                data-testid="boton-cerrar-sesion"
                onClick={alCerrarSesion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Selector superior de rol tipo píldora para usuarios con uno o más roles (RF-01, Guía Visual) */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <section
            aria-label="Roles del sistema"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
              Roles (RF-01):
            </span>
            {rolesDisponibles.map((codigo) => {
              const info = METADATOS_ROLES[codigo];
              const activo = codigo === rolActivo;
              return (
                <button
                  key={codigo}
                  type="button"
                  onClick={() => alCambiarRol(codigo)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    activo
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  {info.etiqueta}
                </button>
              );
            })}
          </section>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span data-testid="resumen-roles-asignados">
              Roles en sesión: <strong>{rolesDisponibles.length}</strong>
            </span>
            <span>
              Rol seleccionado: <strong>{metadatosRol.etiqueta}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Cuerpo principal con menú lateral responsivo según el rol activo */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        <aside
          aria-label="Menú lateral por rol"
          data-testid="menu-lateral-rol"
          className={`${
            menuMovilAbierto ? 'block' : 'hidden'
          } lg:block w-full lg:w-72 shrink-0`}
        >
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-4 sticky top-6">
            <div className="px-2 pt-1 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-dark">
                  Menú del rol activo
                </p>
                <span
                  data-testid="contador-modulos-rol"
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface text-primary border border-slate-200"
                >
                  {modulosDelRol.length} módulos
                </span>
              </div>
              <h2 className="font-display text-base font-bold text-primary mt-0.5">
                {metadatosRol.etiqueta}
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {metadatosRol.resumen}
              </p>
            </div>

            <nav aria-label="Módulos habilitados">
              <ul className="space-y-1">
                {modulosDelRol.map((modulo) => {
                  const seleccionado = modulo.ruta === rutaActiva;
                  return (
                    <li key={modulo.id}>
                      <button
                        type="button"
                        data-testid={`nav-item-${modulo.id}`}
                        aria-current={seleccionado ? 'page' : undefined}
                        onClick={() => manejarSeleccionRuta(modulo)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                          seleccionado
                            ? 'bg-primary text-white font-semibold shadow-sm'
                            : 'text-slate-700 hover:bg-surface hover:text-primary'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <IconoModulo idModulo={modulo.id} />
                          <span className="truncate">{modulo.etiqueta}</span>
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                            seleccionado
                              ? 'bg-white/20 text-white'
                              : 'bg-accent-light text-accent-dark'
                          }`}
                        >
                          {modulo.ruta}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Área de contenido protegido */}
        <main className="flex-1 min-w-0 space-y-6">{children}</main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        AulaConecta v0.1.0 · SB Solutions · Unidad Educativa &ldquo;Andoas&rdquo;
      </footer>
    </div>
  );
}
