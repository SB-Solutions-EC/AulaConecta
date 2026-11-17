import { Module } from '@nestjs/common';
import { ConfiguracionAcademicaController } from './configuracion-academica.controller';
import { ServicioConfiguracionAcademica } from './configuracion-academica.service';

/** Año lectivo, trimestres, cursos y materias (RF-06, RF-07, T1109-M). */
@Module({
  controllers: [ConfiguracionAcademicaController],
  providers: [ServicioConfiguracionAcademica],
})
export class ConfiguracionAcademicaModule {}
