import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { CodigoRol, RespuestaTokenAcceso } from '../api/clienteHttp';
import type { MotivoCierreSesion } from '../api/autenticacionApi';
import { PantallaCambioClaveInicial } from '../componentes/PantallaCambioClaveInicial';
import { PantallaInicioSesion } from '../componentes/PantallaInicioSesion';

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
  nombreUsuario?: string;
  motivoCierreSesion?: MotivoCierreSesion;
  alAutenticarSesion?: (respuesta: RespuestaTokenAcceso) => void;
  alSolicitarInicioSesion?: () => void;
  alCompletarCambioClave?: (respuesta?: RespuestaTokenAcceso) => void;
  alVolverAlPanel?: () => void;
  children: ReactNode;
}

export function RutaProtegida({
  autenticado,
  debeCambiarClave,
  rolActivo,
  rolesPermitidos,
  tituloModulo,
  nombreUsuario = 'ana.perez',
  motivoCierreSesion = null,
  alAutenticarSesion,
  alSolicitarInicioSesion,
  alCompletarCambioClave,
  alVolverAlPanel,
  children,
}: Readonly<PropiedadesRutaProtegida>) {
  if (!autenticado) {
    return (
      <div data-testid="vista-no-autenticado" className="space-y-4">
        <PantallaInicioSesion
          nombreUsuarioInicial={nombreUsuario}
          motivoCierreSesion={motivoCierreSesion}
          alAutenticarExitosamente={(respuesta) => {
            alAutenticarSesion?.(respuesta);
          }}
          alVolverAlPanel={alSolicitarInicioSesion}
        />
      </div>
    );
  }

  if (debeCambiarClave) {
    return (
      <PantallaCambioClaveInicial
        nombreUsuario={nombreUsuario}
        tituloModuloBloqueado={tituloModulo}
        alCambiarClaveExitosamente={(respuesta) => {
          alCompletarCambioClave?.(respuesta);
        }}
      />
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
