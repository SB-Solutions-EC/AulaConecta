import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ExcepcionApi } from '../../../src/comun/excepcion-api';
import { Cedula, Identificador, Opcional, TextoSeguro } from '../../../src/comun/validadores';
import { ClienteIdentidad, RolCuenta } from '../../../src/identidad/cliente-identidad';
import { IdentidadModule } from '../../../src/identidad/identidad.module';
import { Roles, Usuario, UsuarioActual } from './guardia-referencia';

// Implementación de referencia de personas, representaciones y matrícula (RF-04, RF-29) que cumple
// la suite de privacidad (RNF-04). Guarda en memoria y no forma parte del servicio; muestra cómo:
//  - crear la cuenta en ms-identidad con ClienteIdentidad (T1110-A) sin devolver nunca la cédula;
//  - decidir qué ve cada quien SOLO con el usuario del token, nunca con lo que manda el cliente.

const TIPOS = ['DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE'] as const;
type TipoPersona = (typeof TIPOS)[number];
const PERSONAL = ['ADMIN', 'SECRETARIA'];

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

interface Persona {
  id: string;
  usuarioId: string;
  tipo: TipoPersona;
  nombres: string;
  apellidos: string;
  area: string | null;
  version: number;
}
interface Representacion {
  id: string;
  estudianteId: string;
  representanteId: string;
  parentesco: string;
  version: number;
}
interface Matricula {
  id: string;
  estudianteId: string;
  cursoId: string;
  estado: 'ACTIVA';
  version: number;
}

const denegado = (): ExcepcionApi => new ExcepcionApi(403, 'ACCESO_DENEGADO', 'No tienes permiso para esta acción.');
const conflicto = (mensaje: string): ExcepcionApi => new ExcepcionApi(409, 'CONFLICTO', mensaje);

@Controller()
class ControladorMatriculaReferencia {
  private readonly personas = new Map<string, Persona>();
  // La cédula solo sirve para detectar duplicados; se guarda aparte y nunca sale en una respuesta
  private readonly cedulas = new Set<string>();
  private readonly representaciones: Representacion[] = [];
  private readonly matriculas: Matricula[] = [];

  constructor(private readonly identidad: ClienteIdentidad) {}

  /** null = puede ver a todos; si no, los estudiantes cuyos datos le pertenecen. */
  private estudiantesVisibles(usuario: UsuarioActual): Set<string> | null {
    if (usuario.roles.some((rol) => PERSONAL.includes(rol))) {
      return null;
    }
    const propias = [...this.personas.values()].filter((p) => p.usuarioId === usuario.usuarioId);
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
  private personasVisibles(usuario: UsuarioActual): Set<string> | null {
    const estudiantes = this.estudiantesVisibles(usuario);
    if (estudiantes === null) {
      return null;
    }
    const visibles = new Set(estudiantes);
    [...this.personas.values()].filter((p) => p.usuarioId === usuario.usuarioId).forEach((p) => visibles.add(p.id));
    this.representaciones.filter((r) => estudiantes.has(r.estudianteId)).forEach((r) => visibles.add(r.representanteId));
    return visibles;
  }

  @Post('personas')
  @Roles(...PERSONAL)
  async crearPersona(@Body() solicitud: SolicitudPersona): Promise<Persona> {
    const id = solicitud.id ?? randomUUID();
    if (this.personas.has(id) || this.cedulas.has(solicitud.cedula)) {
      throw conflicto('La persona ya está registrada.');
    }
    // ms-identidad genera el usuario; la cédula solo viaja para la clave inicial
    const cuenta = await this.identidad.crearCuenta({
      id,
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      cedulaInicial: solicitud.cedula,
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
    return persona;
  }

  @Get('personas')
  listarPersonas(@Usuario() usuario: UsuarioActual, @Query() { tipo, q }: FiltroPersonas): Persona[] {
    if (!usuario.roles.some((rol) => [...PERSONAL, 'ESTUDIANTE', 'REPRESENTANTE'].includes(rol))) {
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
    const representacion: Representacion = { id: solicitud.id ?? randomUUID(), ...solicitud, version: 0 };
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
    const matricula: Matricula = { id: solicitud.id ?? randomUUID(), ...solicitud, estado: 'ACTIVA', version: 0 };
    this.matriculas.push(matricula);
    return matricula;
  }

  @Get('matriculas')
  listarMatriculas(@Usuario() usuario: UsuarioActual, @Query() { cursoId, estudianteId }: FiltroMatriculas): Matricula[] {
    if (!usuario.roles.some((rol) => [...PERSONAL, 'ESTUDIANTE', 'REPRESENTANTE'].includes(rol))) {
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
})
export class ModuloMatriculaReferencia {}
