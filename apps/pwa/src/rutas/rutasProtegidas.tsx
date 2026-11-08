import type { ReactNode } from 'react';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import type { CodigoRol } from '../api/clienteHttp';

export interface DefinicionModuloNavegacion {
  id: string;
  ruta: string;
  etiqueta: string;
  descripcion: string;
  rolesPermitidos: CodigoRol[];
  sprintObjetivo: string;
}

export interface MetadatosRol {
  codigo: CodigoRol;
  etiqueta: string;
  resumen: string;
}

export const METADATOS_ROLES: Record<CodigoRol, MetadatosRol> = {
  ADMIN: {
    codigo: 'ADMIN',
    etiqueta: 'Administrador (Vicerrector)',
    resumen:
      'Configuración lectiva, supervisión institucional, revisión de planificaciones ERCA y auditoría de accesos.',
  },
  SECRETARIA: {
    codigo: 'SECRETARIA',
    etiqueta: 'Secretaría',
    resumen:
      'Matrícula estudiantil con autorización de WhatsApp e importación masiva de nóminas.',
  },
  DOCENTE: {
    codigo: 'DOCENTE',
    etiqueta: 'Docente',
    resumen:
      'Planificación microcurricular ERCA, registro de asistencia, tareas y libro de calificaciones con soporte offline.',
  },
  ESTUDIANTE: {
    codigo: 'ESTUDIANTE',
    etiqueta: 'Estudiante',
    resumen:
      'Consulta de promedio general, asistencia, avance por asignatura y entregas próximas.',
  },
  REPRESENTANTE: {
    codigo: 'REPRESENTANTE',
    etiqueta: 'Representante',
    resumen:
      'Seguimiento de calificaciones, inasistencias del representado y avisos oportunos por Web Push y WhatsApp.',
  },
};

export const ORDEN_ROLES: CodigoRol[] = [
  'ADMIN',
  'SECRETARIA',
  'DOCENTE',
  'ESTUDIANTE',
  'REPRESENTANTE',
];

export const CATALOGO_MODULOS: DefinicionModuloNavegacion[] = [
  {
    id: 'panel-general',
    ruta: '/panel',
    etiqueta: 'Panel principal',
    descripcion:
      'Resumen operativo por rol y estado en tiempo real de los microservicios a través del API Gateway.',
    rolesPermitidos: [
      'ADMIN',
      'SECRETARIA',
      'DOCENTE',
      'ESTUDIANTE',
      'REPRESENTANTE',
    ],
    sprintObjetivo: 'Sprint 3–6',
  },
  {
    id: 'configuracion-academica',
    ruta: '/configuracion-academica',
    etiqueta: 'Configuración académica',
    descripcion:
      'Año lectivo, trimestres, escala cualitativa (DA, AA, PA, NA), cursos, paralelos y distributivo.',
    rolesPermitidos: ['ADMIN'],
    sprintObjetivo: 'Sprint 4 (RF-04 a RF-07)',
  },
  {
    id: 'personal-docente',
    ruta: '/docentes',
    etiqueta: 'Personal docente y cuentas',
    descripcion:
      'Alta de docentes, generación automática de usuario y desbloqueo de cuentas tras intentos fallidos.',
    rolesPermitidos: ['ADMIN', 'SECRETARIA'],
    sprintObjetivo: 'Sprint 4 (RF-02, RF-08)',
  },
  {
    id: 'matriculas',
    ruta: '/matriculas',
    etiqueta: 'Matrícula y representantes',
    descripcion:
      'Registro de estudiantes, vínculo con representante legal y consentimiento expreso de WhatsApp.',
    rolesPermitidos: ['ADMIN', 'SECRETARIA'],
    sprintObjetivo: 'Sprint 4 (RF-09, RF-32)',
  },
  {
    id: 'importacion-nominas',
    ruta: '/importacion',
    etiqueta: 'Importación de nóminas',
    descripcion:
      'Carga masiva de estudiantes y docentes mediante plantilla CSV/Excel con validación previa por fila.',
    rolesPermitidos: ['ADMIN', 'SECRETARIA'],
    sprintObjetivo: 'Sprint 4 (RF-10)',
  },
  {
    id: 'planificaciones-erca',
    ruta: '/planificaciones',
    etiqueta: 'Planificación ERCA',
    descripcion:
      'Elaboración docente, envío a revisión digital y aprobación u observación por el Vicerrectorado.',
    rolesPermitidos: ['ADMIN', 'DOCENTE'],
    sprintObjetivo: 'Sprint 5 (RF-11 a RF-16)',
  },
  {
    id: 'calificaciones-asistencia',
    ruta: '/calificaciones',
    etiqueta: 'Calificaciones y asistencia',
    descripcion:
      'Registro de aportes (70 % / 30 %), equivalencia cualitativa e inasistencias con cola local sin conexión.',
    rolesPermitidos: ['DOCENTE'],
    sprintObjetivo: 'Sprint 5 (RF-17 a RF-27)',
  },
  {
    id: 'seguimiento-estudiantil',
    ruta: '/seguimiento',
    etiqueta: 'Rendimiento y asistencia',
    descripcion:
      'Consulta de notas parciales y trimestrales, alertas tempranas (< 7,00) y registro de asistencia.',
    rolesPermitidos: ['ESTUDIANTE', 'REPRESENTANTE'],
    sprintObjetivo: 'Sprint 6 (RF-28, RF-38)',
  },
  {
    id: 'avisos-notificaciones',
    ruta: '/avisos',
    etiqueta: 'Avisos y notificaciones',
    descripcion:
      'Historial de notificaciones enviadas por Web Push y WhatsApp sobre tareas, notas e inasistencias.',
    rolesPermitidos: ['ADMIN', 'DOCENTE', 'REPRESENTANTE'],
    sprintObjetivo: 'Sprint 6 (RF-32 a RF-36)',
  },
  {
    id: 'auditoria-seguridad',
    ruta: '/auditoria',
    etiqueta: 'Auditoría de accesos',
    descripcion:
      'Bitácora inmutable de inicios de sesión, bloqueos temporales, cambios de clave y asignación de roles.',
    rolesPermitidos: ['ADMIN'],
    sprintObjetivo: 'Sprint 4 (RNF-09, RNF-12)',
  },
];

export function obtenerModulosPorRol(
  rol: CodigoRol,
): DefinicionModuloNavegacion[] {
  return CATALOGO_MODULOS.filter((modulo) =>
    modulo.rolesPermitidos.includes(rol),
  );
}

export function buscarModuloPorRuta(
  ruta: string,
): DefinicionModuloNavegacion | undefined {
  return CATALOGO_MODULOS.find((modulo) => modulo.ruta === ruta);
}

export function tienePermisoRuta(rolActivo: CodigoRol, ruta: string): boolean {
  const modulo = buscarModuloPorRuta(ruta);
  if (!modulo) {
    return false;
  }
  return modulo.rolesPermitidos.includes(rolActivo);
}

export interface PropiedadesRutaProtegida {
  autenticado: boolean;
  debeCambiarClave: boolean;
  rolActivo: CodigoRol;
  rolesPermitidos: CodigoRol[];
  tituloModulo: string;
  alSolicitarInicioSesion?: () => void;
  alCompletarCambioClave?: () => void;
  alVolverAlPanel?: () => void;
  children: ReactNode;
}

export function RutaProtegida({
  autenticado,
  debeCambiarClave,
  rolActivo,
  rolesPermitidos,
  tituloModulo,
  alSolicitarInicioSesion,
  alCompletarCambioClave,
  alVolverAlPanel,
  children,
}: Readonly<PropiedadesRutaProtegida>) {
  if (!autenticado) {
    return (
      <section
        aria-label="Sesión requerida"
        data-testid="vista-no-autenticado"
        className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 max-w-xl mx-auto text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-accent-light text-accent-dark flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-xl font-bold text-primary">
          Autenticación requerida
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Su sesión ha finalizado o aún no ha iniciado sesión. Para acceder al
          módulo <strong>{tituloModulo}</strong>, ingrese con sus credenciales
          institucionales.
        </p>
        {alSolicitarInicioSesion && (
          <button
            type="button"
            onClick={alSolicitarInicioSesion}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Restaurar sesión
          </button>
        )}
      </section>
    );
  }

  if (debeCambiarClave) {
    return (
      <section
        aria-label="Cambio obligatorio de clave inicial"
        data-testid="vista-cambio-clave-obligatorio"
        className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-200 max-w-xl mx-auto space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Seguridad · RF-03
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-primary">
              Cambio obligatorio de clave inicial
            </h2>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Su cuenta aún utiliza la contraseña inicial generada con su número de
          cédula. Por seguridad (`debeCambiarClave = true`), el acceso a{' '}
          <strong>{tituloModulo}</strong> permanece bloqueado hasta que defina
          una clave personal.
        </p>
        {alCompletarCambioClave && (
          <div className="pt-2">
            <button
              type="button"
              onClick={alCompletarCambioClave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Confirmar cambio de clave
            </button>
          </div>
        )}
      </section>
    );
  }

  if (!rolesPermitidos.includes(rolActivo)) {
    const metadatosRolActual = METADATOS_ROLES[rolActivo];
    const etiquetasAutorizadas = rolesPermitidos
      .map((codigo) => METADATOS_ROLES[codigo].etiqueta)
      .join(', ');

    return (
      <section
        aria-label="Acceso restringido por rol"
        data-testid="vista-acceso-denegado"
        className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-rose-200 max-w-xl mx-auto space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              403 · Acceso restringido (RF-01)
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-primary">
              Sin permisos para {tituloModulo}
            </h2>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          El rol activo <strong>{metadatosRolActual.etiqueta}</strong> no tiene
          autorización para consultar esta ruta. Este módulo está reservado
          para: <strong>{etiquetasAutorizadas}</strong>.
        </p>
        {alVolverAlPanel && (
          <div className="pt-2">
            <button
              type="button"
              onClick={alVolverAlPanel}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Volver al panel principal
            </button>
          </div>
        )}
      </section>
    );
  }

  return <>{children}</>;
}

