import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { Identificador, Opcional } from '../comun/validadores';

// Cuerpos y filtros de /asignaciones (RF-05) según openapi/ms-academico.yaml (SolicitudAsignacion, BloqueHorario).

export const HORAS = ['h1', 'h2', 'h3', 'h4', 'h5'] as const;
export type Hora = (typeof HORAS)[number];

/** 5 días × 5 horas: ninguna asignación puede tener más bloques que la semana entera. */
const MAXIMO_BLOQUES = 25;

export class BloqueHorario {
  @Opcional() @Identificador() id?: string;
  @IsInt({ message: 'dia debe ser un entero' })
  @Min(1, { message: 'dia va de 1 (lunes) a 5 (viernes)' })
  @Max(5, { message: 'dia va de 1 (lunes) a 5 (viernes)' })
  dia!: number;
  @IsIn(HORAS, { message: 'hora debe ser h1, h2, h3, h4 o h5' }) hora!: Hora;
}

export class SolicitudAsignacion {
  @Opcional() @Identificador() id?: string;
  @Identificador() docenteId!: string;
  @Identificador() materiaId!: string;
  @Identificador() cursoId!: string;
  @Opcional()
  @IsArray({ message: 'horarios debe ser una lista de bloques' })
  @ArrayMaxSize(MAXIMO_BLOQUES, { message: `horarios admite hasta ${MAXIMO_BLOQUES} bloques` })
  @ValidateNested({ each: true })
  @Type(() => BloqueHorario)
  horarios?: BloqueHorario[];
}

/** ?docenteId=&cursoId= (opcionales; repetidos llegan como arreglo y se rechazan). */
export class FiltroAsignaciones {
  @Opcional() @Identificador() docenteId?: string;
  @Opcional() @Identificador() cursoId?: string;
}
