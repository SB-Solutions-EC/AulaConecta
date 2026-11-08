import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogIn,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  ErrorHttpApi,
  type RespuestaTokenAcceso,
} from '../api/clienteHttp';
import {
  servicioAutenticacionApi,
  type SolicitudLogin,
} from '../api/autenticacionApi';

export interface PropiedadesPantallaInicioSesion {
  nombreUsuarioInicial?: string;
  alAutenticarExitosamente: (respuesta: RespuestaTokenAcceso) => void;
  alVolverAlPanel?: () => void;
  ejecutarLogin?: (solicitud: SolicitudLogin) => Promise<RespuestaTokenAcceso>;
}

interface EstadoErrorAcceso {
  titulo: string;
  mensaje: string;
  esBloqueoTemporal: boolean;
}

function traducirErrorLogin(error: unknown): EstadoErrorAcceso {
  if (error instanceof ErrorHttpApi) {
    if (error.estado === 423 || error.codigo === 'CUENTA_BLOQUEADA') {
      return {
        titulo: 'Cuenta bloqueada temporalmente (RNF-12)',
        mensaje:
          error.message ||
          'Se superó el límite de 3 intentos fallidos consecutivos. Intente más tarde o solicite el desbloqueo al administrador.',
        esBloqueoTemporal: true,
      };
    }

    if (error.estado === 401 || error.codigo === 'CREDENCIALES_INVALIDAS') {
      return {
        titulo: 'Credenciales inválidas (RF-01)',
        mensaje:
          error.message ||
          'Usuario o contraseña incorrectos. Recuerde que tras 3 intentos fallidos su cuenta se bloqueará temporalmente.',
        esBloqueoTemporal: false,
      };
    }

    return {
      titulo: `Error de acceso (${error.codigo})`,
      mensaje: error.message,
      esBloqueoTemporal: false,
    };
  }

  return {
    titulo: 'Error de conexión con ms-identidad',
    mensaje:
      'No fue posible comunicarse con el servicio de identidad (/api/identidad/auth/login). Verifique su conexión e intente nuevamente.',
    esBloqueoTemporal: false,
  };
}

export function PantallaInicioSesion({
  nombreUsuarioInicial = '',
  alAutenticarExitosamente,
  alVolverAlPanel,
  ejecutarLogin = (solicitud) =>
    servicioAutenticacionApi.iniciarSesion(solicitud),
}: Readonly<PropiedadesPantallaInicioSesion>) {
  const [nombreUsuario, setNombreUsuario] =
    useState<string>(nombreUsuarioInicial);
  const [clave, setClave] = useState<string>('');
  const [mostrarClave, setMostrarClave] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorAcceso, setErrorAcceso] = useState<EstadoErrorAcceso | null>(
    null,
  );

  const manejarEnvio = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const usuarioLimpio = nombreUsuario.trim();

    if (!usuarioLimpio || !clave) {
      setErrorAcceso({
        titulo: 'Campos obligatorios',
        mensaje:
          'Ingrese su nombre de usuario institucional (ej. ana.perez) y su contraseña o cédula inicial.',
        esBloqueoTemporal: false,
      });
      return;
    }

    setEnviando(true);
    setErrorAcceso(null);

    try {
      const respuesta = await ejecutarLogin({
        nombreUsuario: usuarioLimpio,
        clave,
      });
      alAutenticarExitosamente(respuesta);
    } catch (error) {
      setErrorAcceso(traducirErrorLogin(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      aria-label="Pantalla de inicio de sesión"
      data-testid="pantalla-inicio-sesion"
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 max-w-lg mx-auto space-y-6"
    >
      {/* Cabecera institucional de acceso */}
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
          <GraduationCap className="w-6 h-6 text-accent" aria-hidden="true" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
            Acceso institucional · RF-01 y RF-03
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-primary">
            Iniciar sesión en AulaConecta
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Ingrese su usuario (<code className="font-mono">nombre.apellido</code>
            ). Si es su primer ingreso, utilice su número de cédula como clave
            inicial.
          </p>
        </div>
      </div>

      {errorAcceso && (
        <div
          role="alert"
          data-testid="alerta-error-login"
          className={`rounded-xl p-4 border flex items-start gap-3 text-xs sm:text-sm ${
            errorAcceso.esBloqueoTemporal
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {errorAcceso.esBloqueoTemporal ? (
            <ShieldAlert
              className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <AlertTriangle
              className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <div className="space-y-1">
            <p className="font-bold">{errorAcceso.titulo}</p>
            <p className="leading-relaxed">{errorAcceso.mensaje}</p>
          </div>
        </div>
      )}

      <form onSubmit={manejarEnvio} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label
            htmlFor="campo-nombre-usuario"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Nombre de usuario
          </label>
          <div className="relative">
            <User
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="campo-nombre-usuario"
              name="nombreUsuario"
              type="text"
              autoComplete="username"
              placeholder="Ej. ana.perez"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              disabled={enviando}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-surface/60 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="campo-clave-acceso"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Contraseña o clave inicial (cédula)
          </label>
          <div className="relative">
            <Lock
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="campo-clave-acceso"
              name="clave"
              type={mostrarClave ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ingrese su contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={enviando}
              className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 bg-surface/60 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
            />
            <button
              type="button"
              aria-label={
                mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              onClick={() => setMostrarClave((previo) => !previo)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-primary cursor-pointer"
            >
              {mostrarClave ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
          {alVolverAlPanel && (
            <button
              type="button"
              onClick={alVolverAlPanel}
              disabled={enviando}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
            >
              Volver al panel demostrativo
            </button>
          )}

          <button
            type="submit"
            disabled={enviando}
            data-testid="boton-enviar-login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {enviando ? 'Verificando credenciales…' : 'Ingresar a AulaConecta'}
          </button>
        </div>
      </form>

      <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
        <p>
          <strong>Seguridad (`ms-identidad`):</strong> Autenticación con Argon2id
          y emisión de token JWT RS256 en memoria (`POST /api/identidad/auth/login`).
        </p>
      </div>
    </section>
  );
}

