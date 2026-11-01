import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstadoSaludDto } from './estado-salud.dto';

@ApiTags('Salud')
@Controller('health')
export class SaludController {
  private readonly iniciadoEn = Date.now();

  @Get()
  @ApiOperation({ operationId: 'obtenerSaludAcademico', summary: 'Estado de salud del servicio', description: 'Lo usan el gateway y Docker para saber si ms-academico está vivo.' })
  @ApiOkResponse({ type: EstadoSaludDto })
  obtenerEstado(): EstadoSaludDto {
    return {
      status: 'UP',
      servicio: 'ms-academico',
      version: process.env.npm_package_version ?? '0.1.0',
      segundosActivo: Math.floor((Date.now() - this.iniciadoEn) / 1000),
      fecha: new Date().toISOString(),
    };
  }
}
