import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../autenticacion/guardia-jwt';
import { AnioLectivo, Curso, Materia, Periodo, ServicioConfiguracionAcademica } from './configuracion-academica.service';
import { FiltroPorAnio, SolicitudAnioLectivo, SolicitudCurso, SolicitudMateria, SolicitudPeriodo } from './solicitudes.dto';

// Configuración académica (RF-06, RF-07). Consultar basta con haber iniciado sesión;
// crear es solo del administrador. La guardia JWT global aplica las dos reglas.
@ApiTags('Configuración Académica')
@ApiBearerAuth()
@Controller()
export class ConfiguracionAcademicaController {
  constructor(private readonly servicio: ServicioConfiguracionAcademica) {}

  @Get('anios-lectivos')
  listarAniosLectivos(): Promise<AnioLectivo[]> {
    return this.servicio.listarAnios();
  }

  @Post('anios-lectivos')
  @Roles('ADMIN')
  crearAnioLectivo(@Body() solicitud: SolicitudAnioLectivo): Promise<AnioLectivo> {
    return this.servicio.crearAnio(solicitud);
  }

  @Get('periodos')
  listarPeriodos(@Query() { anioLectivoId }: FiltroPorAnio): Promise<Periodo[]> {
    return this.servicio.listarPeriodos(anioLectivoId);
  }

  @Post('periodos')
  @Roles('ADMIN')
  crearPeriodo(@Body() solicitud: SolicitudPeriodo): Promise<Periodo> {
    return this.servicio.crearPeriodo(solicitud);
  }

  @Get('cursos')
  listarCursos(@Query() { anioLectivoId }: FiltroPorAnio): Promise<Curso[]> {
    return this.servicio.listarCursos(anioLectivoId);
  }

  @Post('cursos')
  @Roles('ADMIN')
  crearCurso(@Body() solicitud: SolicitudCurso): Promise<Curso> {
    return this.servicio.crearCurso(solicitud);
  }

  @Get('materias')
  listarMaterias(): Promise<Materia[]> {
    return this.servicio.listarMaterias();
  }

  @Post('materias')
  @Roles('ADMIN')
  crearMateria(@Body() solicitud: SolicitudMateria): Promise<Materia> {
    return this.servicio.crearMateria(solicitud);
  }
}
