import { IsIn } from 'class-validator';
import { Cedula, Identificador, Opcional, TextoSeguro } from '../comun/validadores';

// Cuerpos y filtros de /personas (RF-02, RF-04, RF-05) según openapi/ms-academico.yaml y la
// implementación de referencia de la suite de privacidad (T1111-A).

export const TIPOS_PERSONA = ['DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];
const MENSAJE_TIPO = 'tipo debe ser DOCENTE, ESTUDIANTE o REPRESENTANTE';

export class SolicitudPersona {
  @Opcional() @Identificador() id?: string;
  @IsIn(TIPOS_PERSONA, { message: MENSAJE_TIPO }) tipo!: TipoPersona;
  @TextoSeguro(80, 2) nombres!: string;
  @TextoSeguro(80, 2) apellidos!: string;
  /** Solo para detectar duplicados en el colegio: no viaja a ms-identidad (CR-02) ni vuelve en una respuesta. */
  @Cedula() cedula!: string;
  /** Área académica, solo para docentes. */
  @Opcional() @TextoSeguro(80, 2) area?: string;
}

/** ?tipo=&q= (opcionales; repetidos llegan como arreglo y se rechazan). */
export class FiltroPersonas {
  @Opcional() @IsIn(TIPOS_PERSONA, { message: MENSAJE_TIPO }) tipo?: TipoPersona;
  @Opcional() @TextoSeguro(60) q?: string;
}
