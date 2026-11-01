// Toda la configuración llega por variables de entorno (nada de secretos en el código).
export interface Configuracion {
  entorno: string;
  puerto: number;
  swaggerHabilitado: boolean;
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
  };
}
