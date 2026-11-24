import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../autenticacion/guardia-jwt';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { Calificacion, ServicioCalificaciones } from './calificaciones.service';
import { FiltroCalificaciones, SolicitudCalificacion } from './solicitudes.dto';

// Libreta de calificaciones (RF-17, RF-18, RF-28). La secretaría no ve notas: recibe 403.
@ApiTags('Calificaciones y Tareas')
@ApiBearerAuth()
@Controller('calificaciones')
export class CalificacionesController {
  constructor(private readonly servicio: ServicioCalificaciones) {}

  @Get()
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE')
  listar(@Query() filtro: FiltroCalificaciones, @UsuarioActual() usuario: UsuarioToken): Promise<Calificacion[]> {
    return this.servicio.listar(filtro, usuario);
  }

  @Put()
  @Roles('DOCENTE')
  guardar(@Body() solicitud: SolicitudCalificacion, @UsuarioActual() usuario: UsuarioToken): Promise<Calificacion> {
    return this.servicio.guardar(solicitud, usuario);
  }
}
