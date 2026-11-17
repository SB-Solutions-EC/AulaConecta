import type { Server } from 'node:http';
import { AplicacionReal, crearAplicacionReal } from './aplicacion-real';
import { ModuloMatriculaReferencia } from './referencia/modulo-matricula-referencia';
import { ModuloReferencia } from './referencia/modulo-referencia';
import { construirMundo, Mundo, verificarPrivacidad } from './verificar-privacidad';

// La suite de privacidad contra la implementación de referencia, sobre NucleoModule (la guardia JWT real, sin los endpoints reales).
// Si algo falla aquí, el error está en la suite o en la configuración global, no en los endpoints reales.
describe('Privacidad (RNF-04): implementación de referencia de personas y matrícula', () => {
  let real: AplicacionReal;
  let mundo: Mundo;
  const servidor = (): Server => real.servidor();

  beforeAll(async () => {
    real = await crearAplicacionReal([ModuloReferencia, ModuloMatriculaReferencia]);
    mundo = await construirMundo(servidor());
  });

  afterAll(async () => {
    await real.cerrar();
  });

  it('cada alta pidió su cuenta a ms-identidad con el rol que corresponde y sin enviarle la cédula (CR-02)', () => {
    const recibidas = real.identidad.recibidas;
    const personas = [mundo.estudianteA, mundo.estudianteB, mundo.estudianteC, mundo.representanteA, mundo.representanteB, mundo.representanteAC];
    for (const persona of personas) {
      const solicitud = recibidas.find((s) => s.id === persona.personaId);
      expect(solicitud).toBeDefined();
      expect(JSON.stringify(solicitud)).not.toContain(persona.cedula);
      expect(persona.usuarioId).toBe(persona.personaId);
    }
    expect(recibidas.filter((s) => s.roles.includes('ESTUDIANTE'))).toHaveLength(3);
  });

  verificarPrivacidad(servidor, () => mundo);
});
