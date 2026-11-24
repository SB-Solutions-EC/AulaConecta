import { Module } from '@nestjs/common';
import { CalificacionesModule } from './calificaciones/calificaciones.module';
import { ConfiguracionAcademicaModule } from './configuracion-academica/configuracion-academica.module';
import { NucleoModule } from './nucleo.module';

@Module({
  imports: [NucleoModule, ConfiguracionAcademicaModule, CalificacionesModule],
})
export class AppModule {}
