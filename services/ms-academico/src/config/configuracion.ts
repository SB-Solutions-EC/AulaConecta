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

/** Validación de los tokens de acceso que emite ms-identidad. */
export interface ConfiguracionJwt {
  /** JWKS público de ms-identidad (por la red interna). */
  jwksUrl: string;
  emisor: string;
  audiencia: string;
}

export interface Configuracion {
  entorno: string;
  puerto: number;
  swaggerHabilitado: boolean;
  /** URL de db_academico (DATABASE_URL); sin ella el servicio arranca, pero no puede guardar datos. */
  baseDatosUrl?: string;
  identidad: ConfiguracionIdentidad;
  jwt: ConfiguracionJwt;
}

function urlHttp(variable: string, valor: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${variable} no es una URL válida: ${valor}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${variable} debe usar http o https: ${valor}`);
  }
  return url.toString().replace(/\/$/, '');
}

export function cargarConfiguracion(): Configuracion {
  const entorno = process.env.NODE_ENV ?? 'development';
  const puerto = Number.parseInt(process.env.PORT ?? '3000', 10);

  if (Number.isNaN(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(`PORT no es un puerto válido: ${process.env.PORT}`);
  }

  const urlIdentidad = urlHttp('IDENTIDAD_URL', process.env.IDENTIDAD_URL || 'https://ms-identidad:8443');

  return {
    entorno,
    puerto,
    // En producción Swagger se apaga salvo que se pida explícitamente.
    swaggerHabilitado: (process.env.SWAGGER_HABILITADO ?? (entorno === 'production' ? 'false' : 'true')) === 'true',
    baseDatosUrl: process.env.DATABASE_URL || undefined,
    identidad: {
      url: urlIdentidad,
      clienteId: process.env.AULACONECTA_CLIENTE_ID || 'ms-academico',
      secretoArchivo: process.env.AULACONECTA_CLIENTE_SECRETO_ARCHIVO || undefined,
      tiempoMaximoMs: 5000,
    },
    jwt: {
      // Por defecto, el JWKS que publica la misma ms-identidad
      jwksUrl: urlHttp('AULACONECTA_JWKS_URL', process.env.AULACONECTA_JWKS_URL || `${urlIdentidad}/.well-known/jwks.json`),
      emisor: process.env.AULACONECTA_JWT_EMISOR || 'aulaconecta-identidad',
      audiencia: process.env.AULACONECTA_JWT_AUDIENCIA || 'aulaconecta',
    },
  };
}
