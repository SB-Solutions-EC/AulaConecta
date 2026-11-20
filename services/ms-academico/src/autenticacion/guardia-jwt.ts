import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ExcepcionApi } from '../comun/excepcion-api';
import { UsuarioToken, VerificadorJwt } from './verificador-jwt';

// Guardia global: toda ruta exige un token de ms-identidad salvo que se marque con @Publico().
// @Roles(...) limita la ruta a esos roles (basta con tener uno).

const CLAVE_PUBLICO = 'ruta-publica';
const CLAVE_ROLES = 'roles-permitidos';

export type Rol = 'ADMIN' | 'SECRETARIA' | 'DOCENTE' | 'REPRESENTANTE' | 'ESTUDIANTE';

/** La ruta no pide token (por ejemplo /health). */
export const Publico = (): MethodDecorator & ClassDecorator => SetMetadata(CLAVE_PUBLICO, true);

/** Roles que pueden usar la ruta. Sin este decorador basta con haber iniciado sesión. */
export const Roles = (...roles: Rol[]): MethodDecorator & ClassDecorator => SetMetadata(CLAVE_ROLES, roles);

type PeticionConUsuario = Request & { usuario?: UsuarioToken };

/** Usuario del token, para usarlo en el controlador. */
export const UsuarioActual = createParamDecorator((_dato: unknown, contexto: ExecutionContext): UsuarioToken | undefined => {
  return contexto.switchToHttp().getRequest<PeticionConUsuario>().usuario;
});

@Injectable()
export class GuardiaJwt implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorJwt,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(CLAVE_PUBLICO, destinos)) {
      return true;
    }
    const peticion = contexto.switchToHttp().getRequest<PeticionConUsuario>();
    const usuario = await this.verificador.verificar(peticion.headers.authorization);

    // Igual que ms-identidad: con la clave inicial solo se puede cambiar la clave
    if (usuario.debeCambiarClave) {
      throw new ExcepcionApi(403, 'CAMBIO_CLAVE_PENDIENTE', 'Cambia tu clave inicial para continuar.');
    }
    const permitidos = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, destinos);
    if (permitidos && !permitidos.some((rol) => usuario.roles.includes(rol))) {
      throw new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');
    }
    peticion.usuario = usuario;
    return true;
  }
}
