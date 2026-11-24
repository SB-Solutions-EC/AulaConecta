import { ArrayMaxSize, IsArray, IsInt, IsNumber, Matches, Max, Min, ValidateIf } from 'class-validator';
import { Identificador, Opcional } from '../comun/validadores';

// Cuerpos y filtros de /calificaciones (RF-17, RF-18) según openapi/ms-academico.yaml.
// La nota final y el cualitativo NO se aceptan del cliente: los calcula el servidor.

// El libro oficial tiene 5 aportes por bloque
const MAXIMO_APORTES = 5;

/** Nota de 0 a 10 con hasta 2 decimales (la columna es DECIMAL(4,2): más decimales se perderían). */
function Nota(campo: string, cadaUno = false): PropertyDecorator {
  return (destino, propiedad) => {
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }, { each: cadaUno, message: `${campo} debe ser un número con hasta 2 decimales` })(destino, propiedad);
    Min(0, { each: cadaUno, message: `${campo} va de 0 a 10` })(destino, propiedad);
    Max(10, { each: cadaUno, message: `${campo} va de 0 a 10` })(destino, propiedad);
  };
}

function Aportes(campo: string): PropertyDecorator {
  return (destino, propiedad) => {
    IsArray({ message: `${campo} debe ser una lista de notas` })(destino, propiedad);
    ArrayMaxSize(MAXIMO_APORTES, { message: `${campo} admite hasta ${MAXIMO_APORTES} aportes` })(destino, propiedad);
    Nota(campo, true)(destino, propiedad);
  };
}

export class SolicitudCalificacion {
  @Opcional() @Identificador() id?: string;
  @Identificador() asignacionId!: string;
  @Identificador() matriculaId!: string;
  @IsInt({ message: 'trimestre debe ser un entero' })
  @Min(1, { message: 'trimestre va de 1 a 3' })
  @Max(3, { message: 'trimestre va de 1 a 3' })
  trimestre!: number;
  @Aportes('aportesBloque1') aportesBloque1!: number[];
  @Aportes('aportesBloque2') aportesBloque2!: number[];
  /** null o ausente: sin refuerzo académico. */
  @ValidateIf((_o, valor) => valor !== null && valor !== undefined)
  @Nota('refuerzo')
  refuerzo?: number | null;
  @Nota('notaProyecto') notaProyecto!: number;
  @Nota('notaExamen') notaExamen!: number;
  /** Versión que el docente estaba editando: 0 si la calificación todavía no existe. */
  @IsInt({ message: 'version debe ser un entero' })
  @Min(0, { message: 'version no puede ser negativa' })
  version!: number;
}

/** ?asignacionId=&matriculaId=&trimestre= (todos opcionales; repetidos llegan como arreglo y se rechazan). */
export class FiltroCalificaciones {
  @Opcional() @Identificador() asignacionId?: string;
  @Opcional() @Identificador() matriculaId?: string;
  @Opcional()
  @Matches(/^[1-3]$/, { message: 'trimestre va de 1 a 3' })
  trimestre?: string;
}
