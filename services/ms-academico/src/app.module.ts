import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { FiltroErrores } from './comun/filtro-errores';
import { SoloJsonMiddleware } from './comun/solo-json.middleware';
import { crearPipeValidacion } from './comun/validacion';
import { cargarConfiguracion } from './config/configuracion';
import { IdentidadModule } from './identidad/identidad.module';
import { SaludController } from './salud/salud.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [cargarConfiguracion] }), IdentidadModule],
  controllers: [SaludController],
  providers: [
    // Registrados aquí (y no en main.ts) para que las pruebas usen la misma validación que producción
    { provide: APP_PIPE, useFactory: crearPipeValidacion },
    { provide: APP_FILTER, useClass: FiltroErrores },
  ],
})
export class AppModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(SoloJsonMiddleware).forRoutes('{*ruta}');
  }
}
