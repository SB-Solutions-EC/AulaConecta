import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../autenticacion/guardia-jwt';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { Persona, PersonaCreada, ServicioPersonas } from './personas.service';
import { FiltroPersonas, SolicitudPersona } from './solicitudes.dto';

// Registro de docentes, estudiantes y representantes (RF-02, RF-04, RF-05). Registrar es del personal
// del colegio; el docente no lista personas (las ve por sus asignaciones y su libreta).
@ApiTags('Personas, Docentes y Asignaciones')
@ApiBearerAuth()
@Controller('personas')
export class PersonasController {
  constructor(private readonly servicio: ServicioPersonas) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  crear(@Body() solicitud: SolicitudPersona): Promise<PersonaCreada> {
    return this.servicio.crear(solicitud);
  }

  @Get()
  @Roles('ADMIN', 'SECRETARIA', 'ESTUDIANTE', 'REPRESENTANTE')
  listar(@Query() filtro: FiltroPersonas, @UsuarioActual() usuario: UsuarioToken): Promise<Persona[]> {
    return this.servicio.listar(filtro, usuario);
  }
}
