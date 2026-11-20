import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntregaTarea, TareaAcademica } from '../api/tareasApi';
import { PantallaTareas } from './PantallaTareas';

// Saneamiento de texto en la PWA (T1119-A): el servidor guarda literal lo que escribe una persona,
// así que la pantalla debe mostrarlo como TEXTO. Si algún día se usara dangerouslySetInnerHTML o se
// convirtiera un enlace en <a href> sin revisar su protocolo, estas pruebas fallan.

const CARGAS = [
  '<script>alert("titulo")</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:alert(1)">ver guía</a>',
];
const ENLACE_PELIGROSO = 'javascript:alert(document.cookie)';

const tarea = (id: string, titulo: string, descripcion: string): TareaAcademica => ({
  id,
  titulo,
  descripcion,
  tipo: 'TAREA',
  cursoId: 'demo-curso-1',
  materiaId: 'demo-mat-1',
  periodoId: 'demo-per-1',
  fechaEntrega: '2026-11-28',
  puntajeMaximo: 10,
  creadoPor: 'docente.demo',
  version: 1,
});

const TAREAS: TareaAcademica[] = CARGAS.map((carga, i) => tarea(`tar-xss-${i}`, `Tarea ${i} ${carga}`, `Indicaciones ${carga}`));

const ENTREGAS: EntregaTarea[] = [
  {
    id: 'ent-xss-1',
    tareaId: 'tar-xss-0',
    estudianteId: 'otro.estudiante',
    nombreEstudiante: '<img src=x onerror=alert("nombre")>',
    comentario: '<script>alert("comentario")</script>',
    enlaceAdjunto: ENLACE_PELIGROSO,
    estado: 'ENTREGADA',
    calificacion: null,
    fechaEntregaReal: '2026-11-19',
    version: 1,
  },
  {
    id: 'ent-xss-2',
    tareaId: 'tar-xss-1',
    estudianteId: 'ana.perez',
    nombreEstudiante: 'ana.perez',
    comentario: 'Mi entrega',
    estado: 'CALIFICADA',
    calificacion: 8,
    observacionDocente: '<img src=x onerror=alert("retro")> Revisa el ejercicio 4',
    fechaEntregaReal: '2026-11-18',
    version: 2,
  },
];

/** Nada de lo escrito por una persona se convirtió en elementos, eventos o vínculos ejecutables. */
function sinCodigoInyectado(contenedor: HTMLElement): void {
  expect(contenedor.querySelectorAll('script, img, iframe, object, embed')).toHaveLength(0);
  for (const elemento of contenedor.querySelectorAll('*')) {
    const eventos = elemento.getAttributeNames().filter((nombre) => /^on/i.test(nombre));
    expect(eventos, `<${elemento.tagName.toLowerCase()}> con atributos de evento`).toEqual([]);
  }
  for (const vinculo of contenedor.querySelectorAll('[href], [src]')) {
    const destino = (vinculo.getAttribute('href') ?? vinculo.getAttribute('src') ?? '').trim();
    expect(destino, 'vínculo con un protocolo que ejecuta código').not.toMatch(/^(javascript|data|vbscript):/i);
  }
}

describe('PantallaTareas: el texto de las personas se muestra como texto (XSS, T1119-A)', () => {
  const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

  afterEach(() => {
    alerta.mockClear();
  });

  it('como docente: títulos, descripciones, comentarios y enlaces hostiles se ven literales', () => {
    const { container } = render(
      <PantallaTareas rolActivo="DOCENTE" nombreUsuario="docente.demo" tareasIniciales={TAREAS} entregasIniciales={ENTREGAS} omitirCargaRemota />,
    );

    for (const t of TAREAS) {
      expect(container.textContent).toContain(t.titulo);
    }
    sinCodigoInyectado(container);

    // Entregas de la primera tarea: comentario, nombre y enlace escritos por el estudiante
    fireEvent.click(screen.getByTestId('boton-ver-entregas-tar-xss-0'));
    const modal = screen.getByTestId('modal-entregas-docente');
    expect(modal.textContent).toContain('<script>alert("comentario")</script>');
    expect(modal.textContent).toContain(ENLACE_PELIGROSO);
    sinCodigoInyectado(document.body);
    expect(alerta).not.toHaveBeenCalled();
  });

  it('como estudiante: la retroalimentación del docente se ve literal', () => {
    const { container } = render(
      <PantallaTareas rolActivo="ESTUDIANTE" nombreUsuario="ana.perez" tareasIniciales={TAREAS} entregasIniciales={ENTREGAS} omitirCargaRemota />,
    );

    expect(container.textContent).toContain(TAREAS[0].titulo);
    sinCodigoInyectado(document.body);
    expect(alerta).not.toHaveBeenCalled();
  });
});
