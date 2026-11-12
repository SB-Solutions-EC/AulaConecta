import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { verify } from 'node:crypto';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { AUDIENCIA, CLAVE_PUBLICA, EMISOR, KID, Reclamos } from '../tokens';

// Guardia mínima SOLO para la implementación de referencia de las pruebas.
// La guardia real de ms-academico (validación con el JWKS de ms-identidad) es otra tarea.

const CLAVE_ROLES = 'roles-permitidos';
export const Roles = (...roles: string[]): MethodDecorator => SetMetadata(CLAVE_ROLES, roles);

/** Quién llama, tomado SOLO del token verificado: nunca de cabeceras, parámetros ni del cuerpo. */
export interface UsuarioActual {
  usuarioId: string;
  roles: string[];
}
type PeticionConUsuario = Request & { usuarioActual?: UsuarioActual };

export const Usuario = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioActual =>
    contexto.switchToHttp().getRequest<PeticionConUsuario>().usuarioActual as UsuarioActual,
);

const noAutorizado = (): ExcepcionApi => new ExcepcionApi(401, 'NO_AUTORIZADO', 'Inicia sesión para continuar.');

function leerParte(parte: string): Record<string, unknown> {
  const valor: unknown = JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));
  if (typeof valor !== 'object' || valor === null) {
    throw noAutorizado();
  }
  return valor as Record<string, unknown>;
}

function verificarToken(cabecera: string | undefined): Reclamos {
  const partes = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(cabecera ?? '');
  if (!partes) {
    throw noAutorizado();
  }
  const [, encabezado, cuerpo, firma] = partes;
  let datosEncabezado: Record<string, unknown>;
  let reclamos: Reclamos;
  try {
    datosEncabezado = leerParte(encabezado);
    reclamos = leerParte(cuerpo) as Reclamos;
  } catch {
    throw noAutorizado();
  }
  // El algoritmo lo fija el servidor, nunca el token
  const firmaValida =
    datosEncabezado.alg === 'RS256' &&
    datosEncabezado.kid === KID &&
    verify('sha256', Buffer.from(`${encabezado}.${cuerpo}`), CLAVE_PUBLICA, Buffer.from(firma, 'base64url'));
  const audiencias = Array.isArray(reclamos.aud) ? reclamos.aud : [reclamos.aud];
  const vigente = typeof reclamos.exp === 'number' && reclamos.exp > Date.now() / 1000;
  // Un token de servicio (tipo servicio, sin roles) no representa a una persona
  const deUsuario = reclamos.tipo === 'usuario' && typeof reclamos.sub === 'string' && Array.isArray(reclamos.roles);
  if (!firmaValida || reclamos.iss !== EMISOR || !audiencias.includes(AUDIENCIA) || !vigente || !deUsuario) {
    throw noAutorizado();
  }
  return reclamos;
}

@Injectable()
export class GuardiaReferencia implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest<PeticionConUsuario>();
    const reclamos = verificarToken(peticion.headers.authorization);
    // Igual que ms-identidad: con la clave inicial solo se puede cambiar la clave
    if (reclamos.debe_cambiar_clave !== false) {
      throw new ExcepcionApi(403, 'CAMBIO_CLAVE_PENDIENTE', 'Cambia tu clave inicial para continuar.');
    }
    const permitidos = this.reflector.get<string[] | undefined>(CLAVE_ROLES, contexto.getHandler());
    const roles = reclamos.roles as unknown[];
    if (permitidos && !permitidos.some((rol) => roles.includes(rol))) {
      throw new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');
    }
    peticion.usuarioActual = { usuarioId: reclamos.sub as string, roles: roles.filter((rol): rol is string => typeof rol === 'string') };
    return true;
  }
}
