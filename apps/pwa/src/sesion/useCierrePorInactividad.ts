import { useEffect, useRef } from 'react';

export interface OpcionesCierreInactividad {
  activo: boolean;
  tiempoLimiteMs?: number;
  alExpirarPorInactividad: () => void;
}

const EVENTOS_ACTIVIDAD_USUARIO: readonly (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Supervisa la actividad del usuario en la ventana y ejecuta el cierre
 * automático de sesión cuando transcurre el tiempo límite sin interacción
 * (por defecto 15 minutos, alineado con el tiempo de vida del JWT RS256).
 */
export function useCierrePorInactividad({
  activo,
  tiempoLimiteMs = 15 * 60 * 1000,
  alExpirarPorInactividad,
}: Readonly<OpcionesCierreInactividad>): void {
  const callbackRef = useRef(alExpirarPorInactividad);
  callbackRef.current = alExpirarPorInactividad;

  useEffect(() => {
    if (!activo || tiempoLimiteMs <= 0) {
      return undefined;
    }

    let temporizador: ReturnType<typeof globalThis.setTimeout> | undefined;

    const reiniciarTemporizador = () => {
      if (temporizador !== undefined) {
        globalThis.clearTimeout(temporizador);
      }
      temporizador = globalThis.setTimeout(() => {
        callbackRef.current();
      }, tiempoLimiteMs);
    };

    reiniciarTemporizador();

    for (const nombreEvento of EVENTOS_ACTIVIDAD_USUARIO) {
      window.addEventListener(nombreEvento, reiniciarTemporizador, {
        passive: true,
      });
    }

    return () => {
      if (temporizador !== undefined) {
        globalThis.clearTimeout(temporizador);
      }
      for (const nombreEvento of EVENTOS_ACTIVIDAD_USUARIO) {
        window.removeEventListener(nombreEvento, reiniciarTemporizador);
      }
    };
  }, [activo, tiempoLimiteMs]);
}

