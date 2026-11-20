import { ApiProperty } from '@nestjs/swagger';

// Respeta el esquema RespuestaSalud de openapi/ms-academico.yaml (status obligatorio).
export class EstadoSaludDto {
  @ApiProperty({ enum: ['UP', 'DOWN'], example: 'UP' })
  status: 'UP' | 'DOWN';

  @ApiProperty({ example: 'ms-academico' })
  servicio: string;

  @ApiProperty({ example: '0.1.0' })
  version: string;

  @ApiProperty({ example: 42, description: 'Segundos desde que arrancó el servicio' })
  segundosActivo: number;

  @ApiProperty({ example: '2026-10-28T15:00:00.000Z' })
  fecha: string;
}
