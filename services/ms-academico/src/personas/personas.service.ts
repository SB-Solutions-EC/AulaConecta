import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UsuarioToken } from '../autenticacion/verificador-jwt';
import { PrismaService } from '../base-datos/prisma.service';
import { ExcepcionApi } from '../comun/excepcion-api';
import { Prisma } from '../generado/prisma/client';
import { ClienteIdentidad, RolCuenta } from '../identidad/cliente-identidad';
import { FiltroPersonas, SolicitudPersona, TipoPersona } from './solicitudes.dto';

// Docentes, estudiantes y representantes (RF-02, RF-04, RF-05, T1110-M). La cuenta vive en ms-identidad
// y se enlaza 1 a 1 por persona.usuario_id. La cédula nunca sale de esta base: ni hacia ms-identidad
// (CR-02) ni en una respuesta (RNF-04).

export interface Persona {
  id: string;
  usuarioId: string | null;
  tipo: TipoPersona;
  nombres: string;
  apellidos: string;
  area: string | null;
  version: number;
}

/** Respuesta del alta: la clave temporal llega SOLO aquí, para que la secretaría la entregue (CR-02). */
export interface PersonaCreada extends Persona {
  credenciales: { nombreUsuario: string; claveTemporal?: string; claveTemporalVence?: string };
}

const PERSONAL = ['ADMIN', 'SECRETARIA'];
const LIMITE_LISTADO = 500;

const seleccion = { id: true, usuarioId: true, tipo: true, nombres: true, apellidos: true, area: true, version: true } as const;

const yaRegistrada = (): ExcepcionApi => new ExcepcionApi(409, 'CONFLICTO', 'La persona ya está registrada.');

@Injectable()
export class ServicioPersonas {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identidad: ClienteIdentidad,
  ) {}

  async crear(solicitud: SolicitudPersona): Promise<PersonaCreada> {
    const id = solicitud.id ?? randomUUID();
    // Se revisa antes de crear la cuenta para no dejar cuentas sin persona en ms-identidad
    const existente = await this.prisma.persona.findFirst({ where: { OR: [{ id }, { cedula: solicitud.cedula }] }, select: { id: true } });
    if (existente) {
      throw yaRegistrada();
    }
    // ms-identidad genera el nombre de usuario y la clave temporal; la cuenta usa el mismo UUID que la persona
    const cuenta = await this.identidad.crearCuenta({
      id,
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      roles: [solicitud.tipo as RolCuenta],
    });
    const persona = await this.prisma.persona.create({
      data: {
        id,
        usuarioId: cuenta.id,
        tipo: solicitud.tipo,
        cedula: solicitud.cedula,
        nombres: solicitud.nombres,
        apellidos: solicitud.apellidos,
        area: solicitud.tipo === 'DOCENTE' ? (solicitud.area ?? null) : null,
      },
      select: seleccion,
    });
    // La clave temporal no se guarda en ms-academico: solo pasa en esta respuesta
    return {
      ...persona,
      credenciales: { nombreUsuario: cuenta.nombreUsuario, claveTemporal: cuenta.claveTemporal, claveTemporalVence: cuenta.claveTemporalVence },
    };
  }

  /**
   * El personal del colegio ve a todos. El estudiante y el representante solo ven sus propios datos:
   * la identidad sale únicamente del token. (La representación de T1111-M ampliará lo que ve el representante.)
   */
  async listar(filtro: FiltroPersonas, usuario: UsuarioToken): Promise<Persona[]> {
    const condiciones: Prisma.PersonaWhereInput[] = [{ activo: true }];
    if (!usuario.roles.some((rol) => PERSONAL.includes(rol))) {
      condiciones.push({ usuarioId: usuario.id });
    }
    if (filtro.tipo) {
      condiciones.push({ tipo: filtro.tipo });
    }
    if (filtro.q) {
      condiciones.push({
        OR: [{ nombres: { contains: filtro.q, mode: 'insensitive' } }, { apellidos: { contains: filtro.q, mode: 'insensitive' } }],
      });
    }
    return this.prisma.persona.findMany({
      where: { AND: condiciones },
      select: seleccion,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      take: LIMITE_LISTADO,
    });
  }
}
