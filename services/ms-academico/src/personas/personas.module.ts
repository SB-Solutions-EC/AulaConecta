import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { PersonasController } from './personas.controller';
import { ServicioPersonas } from './personas.service';

@Module({
  imports: [IdentidadModule],
  controllers: [PersonasController],
  providers: [ServicioPersonas],
})
export class PersonasModule {}
