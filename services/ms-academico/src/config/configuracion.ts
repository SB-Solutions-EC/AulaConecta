// Toda la configuración llega por variables de entorno (nada de secretos en el código).
export interface ConfiguracionIdentidad {
  /** URL interna de ms-identidad (por la red interna, sin pasar por el gateway). */
  url: string;
  clienteId: string;
  /** Archivo con el secreto de servicio (un volumen de solo lectura); el secreto nunca va en una variable. */
  secretoArchivo?: string;
  /** Tiempo máximo de cada llamada a ms-identidad. */
  tiempoMaximoMs: number;
}

export interface Configuracion {
  entorno: string;
  puerto: number;
  swaggerHabilitado: boolean;
  identidad: ConfiguracionIdentidad;
}

function urlIdentidad(valor: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`IDENTIDAD_URL no es una URL válida: ${valor}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`IDENTIDAD_URL debe usar http o https: ${valor}`);
  }
  return url.toString().replace(/\/$/, '');
}

export function cargarConfiguracion(): Configuracion {
  const entorno = process.env.NODE_ENV ?? 'development';
  const puerto = Number.parseInt(process.env.PORT ?? '3000', 10);

  if (Number.isNaN(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(`PORT no es un puerto válido: ${process.env.PORT}`);
  }

  return {
    entorno,
    puerto,
    // En producción Swagger se apaga salvo que se pida explícitamente.
    swaggerHabilitado: (process.env.SWAGGER_HABILITADO ?? (entorno === 'production' ? 'false' : 'true')) === 'true',
    identidad: {
      url: urlIdentidad(process.env.IDENTIDAD_URL || 'http://ms-identidad:8080'),
      clienteId: process.env.AULACONECTA_CLIENTE_ID || 'ms-academico',
      secretoArchivo: process.env.AULACONECTA_CLIENTE_SECRETO_ARCHIVO || undefined,
      tiempoMaximoMs: 5000,
    },
  };
}
