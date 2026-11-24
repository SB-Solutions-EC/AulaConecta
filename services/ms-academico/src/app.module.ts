import { Module } from '@nestjs/common';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { CalificacionesModule } from './calificaciones/calificaciones.module';
import { ConfiguracionAcademicaModule } from './configuracion-academica/configuracion-academica.module';
import { NucleoModule } from './nucleo.module';
import { PersonasModule } from './personas/personas.module';

@Module({
  imports: [NucleoModule, ConfiguracionAcademicaModule, PersonasModule, AsignacionesModule, CalificacionesModule],
})
export class AppModule {}
