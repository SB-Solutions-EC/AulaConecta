import { randomUUID } from 'node:crypto';
import { CuentaIdentidad, SolicitudCrearCuenta } from '../../src/identidad/cliente-identidad';

/**
 * Reemplaza a ClienteIdentidad en las pruebas que no levantan ms-identidad: responde como él
 * (el id de la cuenta es el de la persona) y guarda lo recibido para revisarlo.
 * La integración real se prueba en test/integracion/ (T1110-A).
 */
export class IdentidadFalsa {
  readonly recibidas: SolicitudCrearCuenta[] = [];

  async crearCuenta(solicitud: SolicitudCrearCuenta): Promise<CuentaIdentidad> {
    this.recibidas.push(solicitud);
    return {
      id: solicitud.id ?? randomUUID(),
      nombreUsuario: `${solicitud.nombres}.${solicitud.apellidos}`.toLowerCase().replace(/[^a-z.]/g, ''),
      roles: solicitud.roles,
      estado: 'ACTIVO',
      debeCambiarClave: true,
    };
  }
}
