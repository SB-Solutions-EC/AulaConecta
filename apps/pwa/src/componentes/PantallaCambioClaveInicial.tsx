import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  ErrorHttpApi,
  type RespuestaTokenAcceso,
} from '../api/clienteHttp';
import {
  servicioAutenticacionApi,
  type SolicitudCambioClave,
} from '../api/autenticacionApi';

export interface PropiedadesPantallaCambioClaveInicial {
  nombreUsuario: string;
  tituloModuloBloqueado?: string;
  alCambiarClaveExitosamente: (respuesta: RespuestaTokenAcceso) => void;
  ejecutarCambioClave?: (
    solicitud: SolicitudCambioClave,
  ) => Promise<RespuestaTokenAcceso>;
}

const LONGITUD_MINIMA_CLAVE = 8;

function validarSolicitudCambioClave(
  nombreUsuario: string,
  claveActual: string,
  claveNueva: string,
  confirmacionClaveNueva: string,
): string | null {
  if (!claveActual || !claveNueva || !confirmacionClaveNueva) {
    return 'Complete todos los campos para actualizar su clave inicial.';
  }
  if (claveNueva.length < LONGITUD_MINIMA_CLAVE) {
    return 'La nueva contraseña debe tener al menos 8 caracteres.';
  }
  if (claveNueva === claveActual) {
    return 'La nueva clave debe ser distinta de su clave inicial (cédula).';
  }
  if (claveNueva.toLowerCase() === nombreUsuario.trim().toLowerCase()) {
    return 'Por seguridad, la nueva clave no puede ser igual a su nombre de usuario.';
  }
  if (claveNueva !== confirmacionClaveNueva) {
    return 'La confirmación no coincide con la nueva contraseña ingresada.';
  }
  return null;
}

function traducirErrorCambioClave(error: unknown): string {
  if (error instanceof ErrorHttpApi) {
    return error.message || `No se pudo actualizar la clave (${error.codigo}).`;
  }
  return 'No fue posible conectarse con el servicio de identidad (/api/identidad/auth/cambiar-clave).';
}

export function PantallaCambioClaveInicial({
  nombreUsuario,
  tituloModuloBloqueado,
  alCambiarClaveExitosamente,
  ejecutarCambioClave = (solicitud) =>
    servicioAutenticacionApi.cambiarClaveInicial(solicitud),
}: Readonly<PropiedadesPantallaCambioClaveInicial>) {
  const [claveActual, setClaveActual] = useState<string>('');
  const [claveNueva, setClaveNueva] = useState<string>('');
  const [confirmacionClaveNueva, setConfirmacionClaveNueva] =
    useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const manejarEnvio = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const errorValidacion = validarSolicitudCambioClave(
      nombreUsuario,
      claveActual,
      claveNueva,
      confirmacionClaveNueva,
    );

    if (errorValidacion) {
      setMensajeError(errorValidacion);
      return;
    }

    setEnviando(true);
    setMensajeError(null);

    try {
      const respuesta = await ejecutarCambioClave({
        claveActual,
        claveNueva,
      });
      alCambiarClaveExitosamente(respuesta);
    } catch (error) {
      setMensajeError(traducirErrorCambioClave(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      aria-label="Cambio obligatorio de clave inicial"
      data-testid="vista-cambio-clave-obligatorio"
      className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-200 max-w-xl mx-auto space-y-5"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Seguridad obligatoria · RF-03
          </span>
          <h2 className="font-display text-lg sm:text-xl font-bold text-primary">
            Cambio obligatorio de clave inicial
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
            La cuenta <strong>{nombreUsuario}</strong> aún conserva la contraseña
            inicial generada con su número de cédula (
            <code className="font-mono">debeCambiarClave = true</code>).
            {tituloModuloBloqueado ? (
              <>
                {' '}
                Para desbloquear el acceso a{' '}
                <strong>{tituloModuloBloqueado}</strong>, defina una clave
                personal.
              </>
            ) : (
              ' Defina una nueva contraseña personal para continuar.'
            )}
          </p>
        </div>
      </div>

      {mensajeError && (
        <div
          role="alert"
          data-testid="alerta-error-cambio-clave"
          className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs sm:text-sm"
        >
          <AlertTriangle
            className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{mensajeError}</span>
        </div>
      )}

      <form onSubmit={manejarEnvio} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label
            htmlFor="campo-clave-actual"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Clave actual (cédula inicial)
          </label>
          <div className="relative">
            <Lock
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="campo-clave-actual"
              name="claveActual"
              type="password"
              autoComplete="current-password"
              placeholder="Ingrese su clave inicial actual"
              value={claveActual}
              onChange={(e) => setClaveActual(e.target.value)}
              disabled={enviando}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-surface/60 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="campo-clave-nueva"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Nueva contraseña (mín. 8 caracteres)
            </label>
            <input
              id="campo-clave-nueva"
              name="claveNueva"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
              disabled={enviando}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-surface/60 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="campo-confirmar-clave"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="campo-confirmar-clave"
              name="confirmacionClaveNueva"
              type="password"
              autoComplete="new-password"
              placeholder="Repita la nueva contraseña"
              value={confirmacionClaveNueva}
              onChange={(e) => setConfirmacionClaveNueva(e.target.value)}
              disabled={enviando}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-surface/60 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
            />
          </div>
        </div>

        <ul className="text-xs text-slate-500 space-y-1 bg-surface rounded-xl p-3 border border-slate-200/70">
          <li className="flex items-center gap-1.5">
            <CheckCircle2
              className="w-3.5 h-3.5 text-emerald-600 shrink-0"
              aria-hidden="true"
            />
            Mínimo 8 caracteres, distinta de su cédula inicial y de su usuario (
            <code className="font-mono">{nombreUsuario}</code>).
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck
              className="w-3.5 h-3.5 text-primary shrink-0"
              aria-hidden="true"
            />
            Se almacena únicamente el hash Argon2id y se emite un nuevo token
            JWT con <code className="font-mono">debeCambiarClave = false</code>.
          </li>
        </ul>

        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            disabled={enviando}
            data-testid="boton-guardar-cambio-clave"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            {enviando ? 'Actualizando clave…' : 'Confirmar cambio de clave'}
          </button>
        </div>
      </form>
    </section>
  );
}

