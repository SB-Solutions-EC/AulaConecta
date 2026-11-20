import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { FechaCalendario, Identificador, Opcional, TextoSeguro } from '../comun/validadores';

// Cuerpos y filtros de RF-06 (cursos, paralelos y materias) y RF-07 (año lectivo y trimestres),
// según openapi/ms-academico.yaml. El id es opcional porque la PWA lo genera sin conexión.

export class SolicitudAnioLectivo {
  @Opcional() @Identificador() id?: string;
  @IsString({ message: 'nombre debe ser texto' })
  @Matches(/^\d{4}-\d{4}$/, { message: 'nombre debe tener la forma 2026-2027' })
  nombre!: string;
  @FechaCalendario() inicio!: string;
  @FechaCalendario() fin!: string;
  @Opcional() @IsBoolean({ message: 'activo debe ser verdadero o falso' }) activo?: boolean;
}

export class SolicitudPeriodo {
  @Opcional() @Identificador() id?: string;
  @Identificador() anioLectivoId!: string;
  @IsInt({ message: 'numero debe ser un entero' })
  @Min(1, { message: 'numero va de 1 a 3' })
  @Max(3, { message: 'numero va de 1 a 3' })
  numero!: number;
  @FechaCalendario() inicio!: string;
  @FechaCalendario() fin!: string;
}

export class SolicitudCurso {
  @Opcional() @Identificador() id?: string;
  @Identificador() anioLectivoId!: string;
  @TextoSeguro(40) nivel!: string;
  @TextoSeguro(2)
  @Matches(/^[A-Z]{1,2}$/, { message: 'paralelo debe ser una o dos letras mayúsculas' })
  paralelo!: string;
}

export class SolicitudMateria {
  @Opcional() @Identificador() id?: string;
  @TextoSeguro(10, 2)
  @Matches(/^[A-Z0-9]+$/, { message: 'codigo debe tener solo letras mayúsculas y números' })
  codigo!: string;
  @TextoSeguro(80, 2) nombre!: string;
  @Opcional() @TextoSeguro(80, 2) area?: string;
}

/** ?anioLectivoId=... (opcional). Repetido llega como arreglo y se rechaza. */
export class FiltroPorAnio {
  @Opcional() @Identificador() anioLectivoId?: string;
}
