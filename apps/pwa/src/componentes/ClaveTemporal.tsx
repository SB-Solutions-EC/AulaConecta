import { useState } from 'react';
import { KeyRound, RefreshCw, X } from 'lucide-react';
import { ErrorHttpApi } from '../api/clienteHttp';
import {
  servicioCuentasApi,
  type CredencialesTemporales,
  type ServicioCuentasApi,
} from '../api/cuentasApi';

// Clave temporal de las cuentas nuevas (RF-03 v1.1, CR-02): se muestra una sola vez para
// entregarla a la persona y no se guarda en la PWA.

function formatearVencimiento(vence?: string | null): string | null {
  if (!vence) {
    return null;
  }
  const fecha = new Date(vence);
  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

export interface PropiedadesTarjetaClaveTemporal {
  titulo: string;
  credenciales: CredencialesTemporales;
  alCerrar?: () => void;
}

export function TarjetaClaveTemporal({
  titulo,
  credenciales,
  alCerrar,
}: Readonly<PropiedadesTarjetaClaveTemporal>) {
  const vence = formatearVencimiento(credenciales.claveTemporalVence);
  return (
    <div
      aria-live="polite"
      data-testid="tarjeta-clave-temporal"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1.5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-700" aria-hidden="true" />
          {titulo}
        </p>
        {alCerrar ? (
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Ocultar la clave temporal"
            className="text-amber-700 hover:text-amber-900"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p>
        Usuario: <strong className="font-mono">{credenciales.nombreUsuario}</strong>
        {' · '}
        Clave temporal:{' '}
        <strong className="font-mono tracking-wider" data-testid="valor-clave-temporal">
          {credenciales.claveTemporal}
        </strong>
      </p>
      <p className="text-xs">
        Entréguela solo a esta persona. Sirve para un único inicio de sesión
        {vence ? ` y vence el ${vence}` : ' y vence en 72 horas'}; al entrar deberá
        crear su propia clave. No se volverá a mostrar.
      </p>
    </div>
  );
}

export interface PropiedadesBotonClaveTemporal {
  usuarioId: string;
  nombrePersona: string;
  servicio?: Pick<ServicioCuentasApi, 'generarClaveTemporal'>;
}

/** Genera otra clave temporal cuando venció, ya se usó o la persona olvidó su clave (RN-13). */
export function BotonClaveTemporal({
  usuarioId,
  nombrePersona,
  servicio = servicioCuentasApi,
}: Readonly<PropiedadesBotonClaveTemporal>) {
  const [generando, setGenerando] = useState(false);
  const [credenciales, setCredenciales] = useState<CredencialesTemporales | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generar = async () => {
    setGenerando(true);
    setError(null);
    try {
      setCredenciales(await servicio.generarClaveTemporal(usuarioId));
    } catch (causa) {
      setError(
        causa instanceof ErrorHttpApi && causa.message
          ? causa.message
          : 'No se pudo generar la clave temporal.',
      );
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={generando}
        onClick={() => {
          generar().catch(() => undefined);
        }}
        aria-label={`Generar otra clave temporal para ${nombrePersona}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        {generando ? 'Generando…' : 'Generar otra clave'}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {credenciales ? (
        <TarjetaClaveTemporal
          titulo={`Nueva clave temporal de ${nombrePersona}`}
          credenciales={credenciales}
          alCerrar={() => setCredenciales(null)}
        />
      ) : null}
    </div>
  );
}
