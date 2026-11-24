import { Module } from '@nestjs/common';
import { CalificacionesController } from './calificaciones.controller';
import { ServicioCalificaciones } from './calificaciones.service';

@Module({
  controllers: [CalificacionesController],
  providers: [ServicioCalificaciones],
})
export class CalificacionesModule {}
