import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../autenticacion/guardia-jwt';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { Asignacion, ServicioAsignaciones } from './asignaciones.service';
import { FiltroAsignaciones, SolicitudAsignacion } from './solicitudes.dto';

// Asignar docente a materia y curso con bloques horarios (RF-05). Asignar es del administrador.
@ApiTags('Personas, Docentes y Asignaciones')
@ApiBearerAuth()
@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly servicio: ServicioAsignaciones) {}

  @Post()
  @Roles('ADMIN')
  crear(@Body() solicitud: SolicitudAsignacion): Promise<Asignacion> {
    return this.servicio.crear(solicitud);
  }

  @Get()
  @Roles('ADMIN', 'SECRETARIA', 'DOCENTE')
  listar(@Query() filtro: FiltroAsignaciones, @UsuarioActual() usuario: UsuarioToken): Promise<Asignacion[]> {
    return this.servicio.listar(filtro, usuario);
  }
}
