import { Body, Controller, Get, Injectable, Module, Post, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { Cedula, Identificador, Opcional, TextoSeguro } from '../../../src/comun/validadores';
import { ClienteIdentidad, RolCuenta } from '../../../src/identidad/cliente-identidad';
import { IdentidadModule } from '../../../src/identidad/identidad.module';
import { Rol, Roles, UsuarioActual } from '../../../src/autenticacion/guardia-jwt';
import { UsuarioToken } from '../../../src/autenticacion/verificador-jwt';

// Implementación de referencia de personas, representaciones y matrícula (RF-04, RF-29) que cumple
// la suite de privacidad (RNF-04). Guarda en memoria y no forma parte del servicio; muestra cómo:
//  - crear la cuenta en ms-identidad con ClienteIdentidad (T1110-A) sin enviarle la cédula (CR-02) y entregar
//    la clave temporal solo en la respuesta del alta, a la secretaría;
//  - no devolver nunca la cédula;
//  - decidir qué ve cada quien SOLO con el usuario del token, nunca con lo que manda el cliente.

const TIPOS = ['DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE'] as const;
export type TipoPersona = (typeof TIPOS)[number];
const PERSONAL: Rol[] = ['ADMIN', 'SECRETARIA'];
const CON_LECTURA: string[] = [...PERSONAL, 'ESTUDIANTE', 'REPRESENTANTE'];

class SolicitudPersona {
  @Opcional() @Identificador() id?: string;
  @IsIn(TIPOS, { message: 'tipo debe ser DOCENTE, ESTUDIANTE o REPRESENTANTE' }) tipo: TipoPersona;
  @TextoSeguro(100, 2) nombres: string;
  @TextoSeguro(100, 2) apellidos: string;
  @Cedula() cedula: string;
  @Opcional() @TextoSeguro(80, 2) area?: string;
}

class SolicitudRepresentacion {
  @Opcional() @Identificador() id?: string;
  @Identificador() estudianteId: string;
  @Identificador() representanteId: string;
  @TextoSeguro(40, 2) parentesco: string;
}

class SolicitudMatricula {
  @Opcional() @Identificador() id?: string;
  @Identificador() estudianteId: string;
  @Identificador() cursoId: string;
}

class FiltroPersonas {
  @Opcional() @IsIn(TIPOS, { message: 'tipo debe ser DOCENTE, ESTUDIANTE o REPRESENTANTE' }) tipo?: TipoPersona;
  @Opcional() @TextoSeguro(60) q?: string;
}

class FiltroMatriculas {
  @Opcional() @Identificador() cursoId?: string;
  @Opcional() @Identificador() estudianteId?: string;
}

export interface Persona {
  id: string;
  usuarioId: string;
  tipo: TipoPersona;
  nombres: string;
  apellidos: string;
  area: string | null;
  version: number;
}
interface PersonaCreada extends Persona {
  credenciales: { nombreUsuario: string; claveTemporal?: string; claveTemporalVence?: string };
}
export interface Representacion {
  id: string;
  estudianteId: string;
  representanteId: string;
  parentesco: string;
  version: number;
}
export interface Matricula {
  id: string;
  estudianteId: string;
  cursoId: string;
  estado: 'ACTIVA';
  version: number;
}

const denegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');
const conflicto = (mensaje: string): ExcepcionApi => new ExcepcionApi(409, 'CONFLICTO', mensaje);

/** Datos en memoria de la referencia. Lo comparten otras referencias (calificaciones, T1118-A). */
@Injectable()
export class AlmacenReferencia {
  readonly personas = new Map<string, Persona>();
  // La cédula solo sirve para detectar duplicados; se guarda aparte y nunca sale en una respuesta
  readonly cedulas = new Set<string>();
  readonly representaciones: Representacion[] = [];
  readonly matriculas: Matricula[] = [];

  /** Personas de la cuenta del token con ese tipo (una cuenta puede tener varias, por ejemplo docente y representante). */
  personasDe(usuarioId: string, tipo: TipoPersona): Persona[] {
    return [...this.personas.values()].filter((p) => p.usuarioId === usuarioId && p.tipo === tipo);
  }
}

@Controller()
class ControladorMatriculaReferencia {
  private readonly personas: Map<string, Persona>;
  private readonly cedulas: Set<string>;
  private readonly representaciones: Representacion[];
  private readonly matriculas: Matricula[];

  constructor(
    private readonly identidad: ClienteIdentidad,
    almacen: AlmacenReferencia,
  ) {
    ({ personas: this.personas, cedulas: this.cedulas, representaciones: this.representaciones, matriculas: this.matriculas } = almacen);
  }

  /** null = puede ver a todos; si no, los estudiantes cuyos datos le pertenecen. */
  private estudiantesVisibles(usuario: UsuarioToken): Set<string> | null {
    if (usuario.roles.some((rol) => (PERSONAL as string[]).includes(rol))) {
      return null;
    }
    const propias = [...this.personas.values()].filter((p) => p.usuarioId === usuario.id);
    const visibles = new Set<string>();
    for (const persona of propias) {
      if (persona.tipo === 'ESTUDIANTE' && usuario.roles.includes('ESTUDIANTE')) {
        visibles.add(persona.id);
      }
      if (persona.tipo === 'REPRESENTANTE' && usuario.roles.includes('REPRESENTANTE')) {
        this.representaciones.filter((r) => r.representanteId === persona.id).forEach((r) => visibles.add(r.estudianteId));
      }
    }
    return visibles;
  }

  /** Personas que puede ver: sus estudiantes visibles, él mismo y los representantes de sus estudiantes. */
  private personasVisibles(usuario: UsuarioToken): Set<string> | null {
    const estudiantes = this.estudiantesVisibles(usuario);
    if (estudiantes === null) {
      return null;
    }
    const visibles = new Set(estudiantes);
    [...this.personas.values()].filter((p) => p.usuarioId === usuario.id).forEach((p) => visibles.add(p.id));
    this.representaciones.filter((r) => estudiantes.has(r.estudianteId)).forEach((r) => visibles.add(r.representanteId));
    return visibles;
  }

  @Post('personas')
  @Roles(...PERSONAL)
  async crearPersona(@Body() solicitud: SolicitudPersona): Promise<PersonaCreada> {
    const id = solicitud.id ?? randomUUID();
    if (this.personas.has(id) || this.cedulas.has(solicitud.cedula)) {
      throw conflicto('La persona ya está registrada.');
    }
    // ms-identidad genera el usuario y la clave temporal; la cédula se queda en ms-academico (CR-02)
    const cuenta = await this.identidad.crearCuenta({
      id,
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      roles: [solicitud.tipo as RolCuenta],
    });
    const persona: Persona = {
      id,
      usuarioId: cuenta.id,
      tipo: solicitud.tipo,
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      area: solicitud.area ?? null,
      version: 0,
    };
    this.personas.set(id, persona);
    this.cedulas.add(solicitud.cedula);
    // La clave temporal no se guarda en ms-academico: solo pasa en esta respuesta para entregarla a la persona
    return {
      ...persona,
      credenciales: { nombreUsuario: cuenta.nombreUsuario, claveTemporal: cuenta.claveTemporal, claveTemporalVence: cuenta.claveTemporalVence },
    };
  }

  @Get('personas')
  listarPersonas(@UsuarioActual() usuario: UsuarioToken, @Query() { tipo, q }: FiltroPersonas): Persona[] {
    if (!usuario.roles.some((rol) => CON_LECTURA.includes(rol))) {
      throw denegado();
    }
    const visibles = this.personasVisibles(usuario);
    const texto = q?.toLowerCase();
    return [...this.personas.values()].filter(
      (p) =>
        (visibles === null || visibles.has(p.id)) &&
        (!tipo || p.tipo === tipo) &&
        (!texto || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(texto)),
    );
  }

  @Post('representaciones')
  @Roles(...PERSONAL)
  crearRepresentacion(@Body() solicitud: SolicitudRepresentacion): Representacion {
    if (this.personas.get(solicitud.estudianteId)?.tipo !== 'ESTUDIANTE' || this.personas.get(solicitud.representanteId)?.tipo !== 'REPRESENTANTE') {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El estudiante o el representante no existen.');
    }
    if (this.representaciones.some((r) => r.estudianteId === solicitud.estudianteId && r.representanteId === solicitud.representanteId)) {
      throw conflicto('La representación ya existe.');
    }
    const representacion: Representacion = { ...solicitud, id: solicitud.id ?? randomUUID(), version: 0 };
    this.representaciones.push(representacion);
    return representacion;
  }

  @Post('matriculas')
  @Roles(...PERSONAL)
  crearMatricula(@Body() solicitud: SolicitudMatricula): Matricula {
    if (this.personas.get(solicitud.estudianteId)?.tipo !== 'ESTUDIANTE') {
      throw new ExcepcionApi(400, 'DATOS_INVALIDOS', 'El estudiante no existe.');
    }
    if (this.matriculas.some((m) => m.estudianteId === solicitud.estudianteId && m.cursoId === solicitud.cursoId)) {
      throw conflicto('El estudiante ya está matriculado en ese curso.');
    }
    const matricula: Matricula = { ...solicitud, id: solicitud.id ?? randomUUID(), estado: 'ACTIVA', version: 0 };
    this.matriculas.push(matricula);
    return matricula;
  }

  @Get('matriculas')
  listarMatriculas(@UsuarioActual() usuario: UsuarioToken, @Query() { cursoId, estudianteId }: FiltroMatriculas): Matricula[] {
    if (!usuario.roles.some((rol) => CON_LECTURA.includes(rol))) {
      throw denegado();
    }
    const visibles = this.estudiantesVisibles(usuario);
    // Pedir a otro estudiante responde 403 exista o no: no se puede averiguar quién está registrado
    if (estudianteId && visibles !== null && !visibles.has(estudianteId)) {
      throw denegado();
    }
    return this.matriculas.filter(
      (m) =>
        (visibles === null || visibles.has(m.estudianteId)) &&
        (!cursoId || m.cursoId === cursoId) &&
        (!estudianteId || m.estudianteId === estudianteId),
    );
  }
}

@Module({
  imports: [IdentidadModule],
  controllers: [ControladorMatriculaReferencia],
  providers: [AlmacenReferencia],
  exports: [AlmacenReferencia],
})
export class ModuloMatriculaReferencia {}
