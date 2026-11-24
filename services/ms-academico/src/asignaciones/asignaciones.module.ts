import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller';
import { ServicioAsignaciones } from './asignaciones.service';

@Module({
  controllers: [AsignacionesController],
  providers: [ServicioAsignaciones],
})
export class AsignacionesModule {}
