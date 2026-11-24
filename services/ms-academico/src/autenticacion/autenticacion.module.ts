import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GuardiaJwt } from './guardia-jwt';
import { VerificadorJwt } from './verificador-jwt';

// Autenticación con los tokens de ms-identidad: la guardia queda aplicada a todas las rutas.
@Module({
  providers: [VerificadorJwt, { provide: APP_GUARD, useClass: GuardiaJwt }],
  exports: [VerificadorJwt],
})
export class AutenticacionModule {}
