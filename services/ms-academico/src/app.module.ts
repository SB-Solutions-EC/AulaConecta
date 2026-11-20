import { Module } from '@nestjs/common';
import { ConfiguracionAcademicaModule } from './configuracion-academica/configuracion-academica.module';
import { NucleoModule } from './nucleo.module';

@Module({
  imports: [NucleoModule, ConfiguracionAcademicaModule],
})
export class AppModule {}
